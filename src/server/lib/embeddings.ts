/**
 * OpenAI embeddings utility.
 * Singleton client + batch embedding generation.
 */

import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-...") {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}
