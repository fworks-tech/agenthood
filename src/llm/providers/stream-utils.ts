import type { LLMChunk } from "../types.ts"

export async function* createStreamGenerator<T>(
  source: AsyncIterable<T>,
  extractDelta: (chunk: T) => string,
): AsyncGenerator<LLMChunk> {
  for await (const chunk of source) {
    const delta = extractDelta(chunk);
    yield { delta, done: false };
  }
  yield { delta: "", done: true };
}
