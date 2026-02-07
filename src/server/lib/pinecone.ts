/**
 * Pinecone vector database utility.
 * Singleton client + upsert/delete/query helpers.
 * Auto-creates the index if it doesn't exist.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import type { RecordMetadata } from "@pinecone-database/pinecone";

let pineconeClient: Pinecone | null = null;
let indexEnsured = false;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey || apiKey === "pcsk_...") {
      throw new Error("PINECONE_API_KEY is not configured");
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

const INDEX_NAME = () => process.env.PINECONE_INDEX_NAME || "bc-emissions-docs";

async function ensureIndex() {
  if (indexEnsured) return;

  const pc = getPinecone();
  const name = INDEX_NAME();

  try {
    await pc.describeIndex(name);
    indexEnsured = true;
  } catch {
    // Index doesn't exist — create it
    console.log(`Pinecone index "${name}" not found, creating...`);
    await pc.createIndex({
      name,
      dimension: 1536,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
    console.log(`Pinecone index "${name}" created successfully.`);
    indexEnsured = true;
  }
}

async function getIndex() {
  await ensureIndex();
  return getPinecone().index(INDEX_NAME());
}

export async function upsertVectors(
  documentId: string,
  chunks: { text: string; index: number }[],
  embeddings: number[][],
  metadata: { filename: string; category?: string }
) {
  const index = await getIndex();

  const vectors = chunks.map((chunk, i) => ({
    id: `doc_${documentId}_chunk_${chunk.index}`,
    values: embeddings[i],
    metadata: {
      documentId,
      chunkIndex: chunk.index,
      filename: metadata.filename,
      category: metadata.category || "",
      text: chunk.text,
    } satisfies RecordMetadata,
  }));

  // Pinecone supports up to 100 vectors per upsert
  const UPSERT_BATCH = 100;
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
    const batch = vectors.slice(i, i + UPSERT_BATCH);
    await index.upsert({ records: batch });
  }

  return vectors.length;
}

export async function deleteDocumentVectors(documentId: string) {
  const index = await getIndex();

  try {
    await index.deleteMany({
      filter: { documentId: { $eq: documentId } },
    });
  } catch {
    console.warn(
      `Filter-based delete failed for doc ${documentId}, attempting ID-based delete`
    );
    const ids = Array.from({ length: 1000 }, (_, i) => `doc_${documentId}_chunk_${i}`);
    await index.deleteMany({ ids });
  }
}

export async function queryVectors(embedding: number[], topK = 5) {
  const index = await getIndex();

  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return results.matches || [];
}
