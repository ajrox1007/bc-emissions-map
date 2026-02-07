/**
 * Text chunking utility for document vectorization.
 * Splits text into overlapping chunks at sentence boundaries.
 */

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

interface Chunk {
  text: string;
  index: number;
}

export function chunkText(text: string): Chunk[] {
  if (!text || text.trim().length === 0) return [];

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= CHUNK_SIZE) {
    return [{ text: normalized, index: 0 }];
  }

  // Split into sentences
  const sentences = normalized.match(/[^.!?\n]+[.!?\n]?\s*/g) || [normalized];

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentChunk.length + sentence.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({ text: currentChunk.trim(), index: chunkIndex });
      chunkIndex++;

      // Start new chunk with overlap from the end of previous chunk
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP);
      currentChunk = currentChunk.substring(overlapStart) + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  // Push final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}
