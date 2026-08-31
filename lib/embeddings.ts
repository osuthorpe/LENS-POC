import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-large';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 128;
export const EMBEDDING_REQUEST_TIMEOUT_MS = 10_000;
export const EMBEDDING_MAX_RETRIES = 1;

export interface EmbeddingProvider {
  model: string;
  dimensions: number;
  embedTexts(inputs: string[]): Promise<number[][]>;
}

interface OpenAiEmbeddingProviderOptions {
  apiKey?: string;
  client?: Pick<OpenAI, 'embeddings'>;
  dimensions?: number;
  model?: string;
}

export function validateEmbedding(
  embedding: number[],
  dimensions: number,
  index: number,
) {
  if (embedding.length !== dimensions) {
    throw new Error(`Embedding ${index} does not have ${dimensions} values.`);
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding ${index} contains an invalid value.`);
  }
  return embedding;
}

export function createOpenAiEmbeddingProvider(
  options: OpenAiEmbeddingProviderOptions = {},
): EmbeddingProvider {
  const model = options.model ?? EMBEDDING_MODEL;
  const dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS;
  let client = options.client;

  function getClient() {
    if (client) return client;
    const apiKey = options.apiKey === undefined
      ? process.env.OPENAI_API_KEY?.trim()
      : options.apiKey.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embedding requests.');
    }
    client = new OpenAI({
      apiKey,
      timeout: EMBEDDING_REQUEST_TIMEOUT_MS,
      maxRetries: EMBEDDING_MAX_RETRIES,
    });
    return client;
  }

  return {
    model,
    dimensions,
    async embedTexts(inputs) {
      if (!inputs.length) return [];
      if (inputs.some((input) => !input.trim())) {
        throw new Error('Embedding input must contain text.');
      }

      const embeddings: number[][] = [];
      for (let start = 0; start < inputs.length; start += EMBEDDING_BATCH_SIZE) {
        const batch = inputs.slice(start, start + EMBEDDING_BATCH_SIZE);
        let response;
        try {
          response = await getClient().embeddings.create({
            model,
            dimensions,
            encoding_format: 'float',
            input: batch,
          });
        } catch (error) {
          const status = typeof error === 'object' && error && 'status' in error
            ? Number(error.status)
            : null;
          throw new Error(
            status
              ? `The embedding request failed with status ${status}.`
              : 'The embedding request failed.',
            { cause: error },
          );
        }

        if (response.data.length !== batch.length) {
          throw new Error('The embedding response did not include every input.');
        }
        const ordered = [...response.data].sort((left, right) => left.index - right.index);
        for (let index = 0; index < ordered.length; index += 1) {
          const item = ordered[index];
          if (!item || item.index !== index) {
            throw new Error('The embedding response indexes are not valid.');
          }
          embeddings.push(validateEmbedding(item.embedding, dimensions, start + index));
        }
      }
      return embeddings;
    },
  };
}

export const openAiEmbeddingProvider = createOpenAiEmbeddingProvider();

export async function embedText(
  input: string,
  provider: EmbeddingProvider = openAiEmbeddingProvider,
) {
  const [embedding] = await provider.embedTexts([input]);
  if (!embedding) throw new Error('The embedding response is empty.');
  return embedding;
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}
