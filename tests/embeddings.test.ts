import { describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  createOpenAiEmbeddingProvider,
} from '@/lib/embeddings';

function vector(value: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

function providerWith(create: ReturnType<typeof vi.fn>) {
  return createOpenAiEmbeddingProvider({
    apiKey: 'test-key',
    client: { embeddings: { create } } as never,
  });
}

describe('OpenAI embedding provider', () => {
  it('sends the approved model and restores the input order', async () => {
    const first = vector(0.1);
    const second = vector(0.2);
    const create = vi.fn().mockResolvedValue({
      data: [
        { object: 'embedding', index: 1, embedding: second },
        { object: 'embedding', index: 0, embedding: first },
      ],
    });
    const provider = providerWith(create);

    await expect(provider.embedTexts(['revenue', 'runway'])).resolves.toEqual([
      first,
      second,
    ]);
    expect(create).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: 'float',
      input: ['revenue', 'runway'],
    });
  });

  it('rejects an incomplete or invalid response', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
      });
    const provider = providerWith(create);

    await expect(provider.embedTexts(['revenue'])).rejects.toThrow(
      'did not include every input',
    );
    await expect(provider.embedTexts(['revenue'])).rejects.toThrow(
      `does not have ${EMBEDDING_DIMENSIONS} values`,
    );
  });

  it('rejects empty input and non-finite values', async () => {
    const invalidVector = vector(0.1);
    invalidVector[0] = Number.NaN;
    const create = vi.fn().mockResolvedValue({
      data: [{ object: 'embedding', index: 0, embedding: invalidVector }],
    });
    const provider = providerWith(create);

    await expect(provider.embedTexts(['  '])).rejects.toThrow(
      'Embedding input must contain text.',
    );
    await expect(provider.embedTexts(['revenue'])).rejects.toThrow(
      'contains an invalid value',
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports a service status without provider details', async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error('Provider detail must stay private.'), { status: 429 }),
    );
    const provider = providerWith(create);

    const request = provider.embedTexts(['revenue']);
    await expect(request).rejects.toThrow(
      'The embedding request failed with status 429.',
    );
    await expect(request).rejects.not.toThrow('Provider detail must stay private.');
  });
});
