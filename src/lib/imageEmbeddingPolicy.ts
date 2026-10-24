export const IMAGE_BATCH_SIZE = 12;
export const IMAGE_DIMENSIONS = 3072;

export class ImageEmbeddingError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) {
    super(message);
  }
}

export function embeddingFailurePolicy(error: ImageEmbeddingError, attempts: number) {
  const retryable = error.status === 429 || error.status >= 500;
  return {
    pause: [401, 402, 403, 404].includes(error.status) || error.status === 422,
    retry: retryable && attempts < 4,
    delayMs: Math.max(error.retryAfter, 60_000 * 2 ** attempts),
  };
}

export function readImageVector(data: { data?: { index: number; embedding: number[] }[] }): number[] {
  const vector = data.data?.find((item) => item.index === 0)?.embedding;
  if (!vector || vector.length !== IMAGE_DIMENSIONS || !vector.every(Number.isFinite)) {
    throw new ImageEmbeddingError("The image service returned no valid image vector.", 422);
  }
  return vector;
}