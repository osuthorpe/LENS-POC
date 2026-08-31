import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  openAiEmbeddingProvider,
} from '../lib/embeddings';

function cosineSimilarity(left: number[], right: number[]) {
  let dotProduct = 0;
  let leftLength = 0;
  let rightLength = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftLength += leftValue * leftValue;
    rightLength += rightValue * rightValue;
  }

  return dotProduct / (Math.sqrt(leftLength) * Math.sqrt(rightLength));
}

const inputs = [
  'The company has nine months of cash runway.',
  'The business has enough cash for about three quarters.',
  'The company opened four infrastructure engineering roles.',
];
const startedAt = performance.now();
const embeddings = await openAiEmbeddingProvider.embedTexts(inputs);
const durationMs = Math.round(performance.now() - startedAt);
const relatedSimilarity = cosineSimilarity(embeddings[0] ?? [], embeddings[1] ?? []);
const unrelatedSimilarity = cosineSimilarity(embeddings[0] ?? [], embeddings[2] ?? []);

if (embeddings.length !== inputs.length) {
  throw new Error('The embedding response does not have the required item count.');
}
if (relatedSimilarity <= unrelatedSimilarity) {
  throw new Error('The related text is not the closest text.');
}

console.table({
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  itemCount: embeddings.length,
  durationMs,
  semanticOrder: 'pass',
});
