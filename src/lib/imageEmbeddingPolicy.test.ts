import { describe, expect, it } from "vitest";
import { embeddingFailurePolicy, IMAGE_BATCH_SIZE, ImageEmbeddingError, readImageVector } from "./imageEmbeddingPolicy";

describe("automatic catalogue image indexing", () => {
  it("bounds each run to twelve catalogue images", () => expect(IMAGE_BATCH_SIZE).toBe(12));
  it.each([401, 402, 403, 404, 422])("pauses the entire chain on terminal status %s", (status) => {
    expect(embeddingFailurePolicy(new ImageEmbeddingError("blocked", status), 1)).toMatchObject({ pause: true, retry: false });
  });
  it.each([429, 500, 503])("defers transient status %s and stops after four attempts", (status) => {
    expect(embeddingFailurePolicy(new ImageEmbeddingError("busy", status, 300_000), 1)).toMatchObject({ pause: false, retry: true, delayMs: 300_000 });
    expect(embeddingFailurePolicy(new ImageEmbeddingError("busy", status), 4).retry).toBe(false);
  });
  it("does not replay an invalid image request", () => expect(embeddingFailurePolicy(new ImageEmbeddingError("invalid", 400), 1)).toMatchObject({ pause: false, retry: false }));
  it("uses index zero and exactly 3072 finite dimensions", () => {
    const vector = Array(3072).fill(0.1);
    expect(readImageVector({ data: [{ index: 1, embedding: [1] }, { index: 0, embedding: vector }] })).toEqual(vector);
    expect(() => readImageVector({ data: [{ index: 0, embedding: [1] }] })).toThrow();
    expect(() => readImageVector({ data: [{ index: 0, embedding: [...vector.slice(1), NaN] }] })).toThrow();
  });
});