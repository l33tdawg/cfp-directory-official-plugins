/**
 * AI Paper Reviewer - Model Fetcher Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchOpenAIModels,
  fetchAnthropicModels,
  fetchGeminiModels,
  fetchModelsForProvider,
} from '../../plugins/ai-paper-reviewer/lib/model-fetcher';

describe('Model Fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // OpenAI
  // ===========================================================================

  describe('fetchOpenAIModels', () => {
    it('should return error when no API key provided', async () => {
      const result = await fetchOpenAIModels('');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_API_KEY');
    });

    it('should return error on 401 unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      const result = await fetchOpenAIModels('invalid-key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
      expect(result.error?.message).toContain('Invalid OpenAI API key');
    });

    it('should return error on 429 rate limit', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      } as Response);

      const result = await fetchOpenAIModels('valid-key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
    });

    it('should filter and return chat models only', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'gpt-4o', created: 1700000000, owned_by: 'openai', object: 'model' },
          { id: 'gpt-4o-mini', created: 1690000000, owned_by: 'openai', object: 'model' },
          { id: 'gpt-3.5-turbo', created: 1680000000, owned_by: 'openai', object: 'model' },
          { id: 'text-embedding-ada-002', created: 1670000000, owned_by: 'openai', object: 'model' },
          { id: 'whisper-1', created: 1660000000, owned_by: 'openai', object: 'model' },
          { id: 'dall-e-3', created: 1650000000, owned_by: 'openai', object: 'model' },
          { id: 'tts-1', created: 1640000000, owned_by: 'openai', object: 'model' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchOpenAIModels('valid-key');
      expect(result.success).toBe(true);
      expect(result.models).toBeDefined();

      // Should include chat models
      const modelIds = result.models!.map((m) => m.id);
      expect(modelIds).toContain('gpt-4o');
      expect(modelIds).toContain('gpt-4o-mini');
      expect(modelIds).toContain('gpt-3.5-turbo');

      // Should exclude non-chat models
      expect(modelIds).not.toContain('text-embedding-ada-002');
      expect(modelIds).not.toContain('whisper-1');
      expect(modelIds).not.toContain('dall-e-3');
      expect(modelIds).not.toContain('tts-1');
    });

    it('should mark only one recommended model (gpt-4o)', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'gpt-4o', created: 1700000000, owned_by: 'openai', object: 'model' },
          { id: 'gpt-4o-mini', created: 1690000000, owned_by: 'openai', object: 'model' },
          { id: 'gpt-3.5-turbo', created: 1680000000, owned_by: 'openai', object: 'model' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchOpenAIModels('valid-key');
      expect(result.success).toBe(true);

      // Only gpt-4o should be recommended
      const gpt4o = result.models!.find((m) => m.id === 'gpt-4o');
      expect(gpt4o?.name).toContain('(Recommended)');

      // gpt-4o-mini should NOT be recommended (only one recommended per provider)
      const gpt4oMini = result.models!.find((m) => m.id === 'gpt-4o-mini');
      expect(gpt4oMini?.name).not.toContain('(Recommended)');

      const gpt35 = result.models!.find((m) => m.id === 'gpt-3.5-turbo');
      expect(gpt35?.name).not.toContain('(Recommended)');
    });

    it('should limit results to 10 models', async () => {
      const mockResponse = {
        object: 'list',
        data: Array.from({ length: 20 }, (_, i) => ({
          id: `gpt-4-variant-${i}`,
          created: 1700000000 - i * 1000,
          owned_by: 'openai',
          object: 'model',
        })),
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchOpenAIModels('valid-key');
      expect(result.success).toBe(true);
      expect(result.models!.length).toBeLessThanOrEqual(10);
    });

    it('should handle network errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

      const result = await fetchOpenAIModels('valid-key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toContain('Network failure');
    });
  });

  // ===========================================================================
  // Anthropic
  // ===========================================================================

  describe('fetchAnthropicModels', () => {
    it('should return error when no API key provided', async () => {
      const result = await fetchAnthropicModels('');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_API_KEY');
    });

    it('should return error on 401 unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      const result = await fetchAnthropicModels('invalid-key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });

    it('should return models with display names', async () => {
      const mockResponse = {
        data: [
          {
            id: 'claude-sonnet-4-20250514',
            created_at: '2025-05-14T00:00:00Z',
            display_name: 'Claude Sonnet 4',
            type: 'model',
          },
          {
            id: 'claude-haiku-4-20250514',
            created_at: '2025-05-14T00:00:00Z',
            display_name: 'Claude Haiku 4',
            type: 'model',
          },
        ],
        has_more: false,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchAnthropicModels('valid-key');
      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(2);

      const sonnet = result.models!.find((m) => m.id === 'claude-sonnet-4-20250514');
      expect(sonnet?.name).toContain('Claude Sonnet 4');
      expect(sonnet?.name).toContain('(Recommended)');
    });

    it('should send correct headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], has_more: false }),
      } as Response);

      await fetchAnthropicModels('test-api-key');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('api.anthropic.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });
  });

  // ===========================================================================
  // Gemini
  // ===========================================================================

  describe('fetchGeminiModels', () => {
    it('should return error when no API key provided', async () => {
      const result = await fetchGeminiModels('');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_API_KEY');
    });

    it('should return error on 401/403 unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: { message: 'API key not valid' },
          }),
      } as Response);

      const result = await fetchGeminiModels('invalid-key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_KEY');
    });

    it('should filter to generateContent capable models', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            baseModelId: 'gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/gemini-1.5-pro',
            baseModelId: 'gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/embedding-001',
            baseModelId: 'embedding-001',
            displayName: 'Embedding Model',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchGeminiModels('valid-key');
      expect(result.success).toBe(true);

      const modelIds = result.models!.map((m) => m.id);
      expect(modelIds).toContain('gemini-2.0-flash');
      expect(modelIds).toContain('gemini-1.5-pro');
      expect(modelIds).not.toContain('embedding-001');
    });

    it('should include API key in header (not URL) for security', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      await fetchGeminiModels('my-gemini-key');

      // Security: API key should be in header, NOT in URL
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('key='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': 'my-gemini-key',
          }),
        })
      );
    });

    it('should filter out versioned variants (ending in 3 digits)', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            baseModelId: 'gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.0-flash-001',
            baseModelId: 'gemini-2.0-flash-001',
            displayName: 'Gemini 2.0 Flash (v001)',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchGeminiModels('valid-key');
      expect(result.success).toBe(true);

      // Should only have the main model, not the versioned variant
      const modelIds = result.models!.map((m) => m.id);
      expect(modelIds).toContain('gemini-2.0-flash');
      expect(modelIds).not.toContain('gemini-2.0-flash-001');
    });

    it('should filter out image generation, TTS, and experimental models', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            baseModelId: 'gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.0-flash-image-generation',
            baseModelId: 'gemini-2.0-flash-image-generation',
            displayName: 'Gemini 2.0 Flash (Image Generation)',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-experimental-1206',
            baseModelId: 'gemini-experimental-1206',
            displayName: 'Gemini Experimental 1206',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.5-pro-preview',
            baseModelId: 'gemini-2.5-pro-preview',
            displayName: 'Gemini 2.5 Pro Preview TTS',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchGeminiModels('valid-key');
      expect(result.success).toBe(true);

      const modelIds = result.models!.map((m) => m.id);
      // Should include the main model
      expect(modelIds).toContain('gemini-2.0-flash');
      // Should exclude image generation, experimental, and preview models
      expect(modelIds).not.toContain('gemini-2.0-flash-image-generation');
      expect(modelIds).not.toContain('gemini-experimental-1206');
      expect(modelIds).not.toContain('gemini-2.5-pro-preview');
    });

    it('should only mark gemini-2.0-flash as recommended', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            baseModelId: 'gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-1.5-pro',
            baseModelId: 'gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.5-pro',
            baseModelId: 'gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchGeminiModels('valid-key');
      expect(result.success).toBe(true);

      // Only gemini-2.0-flash should be recommended
      const flash = result.models!.find((m) => m.id === 'gemini-2.0-flash');
      expect(flash?.name).toContain('(Recommended)');

      // Other models should NOT be recommended
      const pro15 = result.models!.find((m) => m.id === 'gemini-1.5-pro');
      expect(pro15?.name).not.toContain('(Recommended)');

      const pro25 = result.models!.find((m) => m.id === 'gemini-2.5-pro');
      expect(pro25?.name).not.toContain('(Recommended)');
    });

    it('should limit results to 10 models', async () => {
      const mockResponse = {
        models: Array.from({ length: 20 }, (_, i) => ({
          name: `models/gemini-model-${i}`,
          baseModelId: `gemini-model-${i}`,
          displayName: `Gemini Model ${i}`,
          supportedGenerationMethods: ['generateContent'],
        })),
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await fetchGeminiModels('valid-key');
      expect(result.success).toBe(true);
      expect(result.models!.length).toBeLessThanOrEqual(10);
    });
  });

  // ===========================================================================
  // Dispatcher
  // ===========================================================================

  describe('fetchModelsForProvider', () => {
    it('should route to OpenAI for "openai" provider', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ object: 'list', data: [] }),
      } as Response);

      const result = await fetchModelsForProvider('openai', 'key');
      expect(result.success).toBe(true);
    });

    it('should route to Anthropic for "anthropic" provider', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], has_more: false }),
      } as Response);

      const result = await fetchModelsForProvider('anthropic', 'key');
      expect(result.success).toBe(true);
    });

    it('should route to Gemini for "gemini" provider', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const result = await fetchModelsForProvider('gemini', 'key');
      expect(result.success).toBe(true);
    });

    it('should return error for unknown provider', async () => {
      const result = await fetchModelsForProvider('unknown', 'key');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toContain('Unsupported provider');
    });
  });
});
