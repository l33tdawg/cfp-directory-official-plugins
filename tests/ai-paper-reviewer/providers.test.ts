/**
 * AI Paper Reviewer - Provider Module Tests
 *
 * Tests for OpenAI, Anthropic, and Gemini API integrations,
 * including the Google Search grounding feature.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callOpenAI,
  callAnthropic,
  callGemini,
  callProvider,
  type ProviderOptions,
} from '../../plugins/ai-paper-reviewer/lib/providers';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockOptions(overrides: Partial<ProviderOptions> = {}): ProviderOptions {
  return {
    apiKey: 'test-api-key',
    model: 'test-model',
    maxTokens: 1000,
    temperature: 0.3,
    systemPrompt: 'You are a helpful assistant.',
    userContent: 'Analyze this submission.',
    ...overrides,
  };
}

// =============================================================================
// Mock Fetch
// =============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// =============================================================================
// OpenAI Tests
// =============================================================================

describe('callOpenAI', () => {
  it('sends correct request format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Test response' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
    });

    const opts = createMockOptions({ model: 'gpt-4o' });
    await callOpenAI(opts);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o');
    expect(body.max_tokens).toBe(1000);
    expect(body.temperature).toBe(0.3);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('returns response with token usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'AI analysis result' } }],
          usage: { prompt_tokens: 150, completion_tokens: 200 },
        }),
    });

    const result = await callOpenAI(createMockOptions());

    expect(result.content).toBe('AI analysis result');
    expect(result.usage.inputTokens).toBe(150);
    expect(result.usage.outputTokens).toBe(200);
    expect(result.usage.totalTokens).toBe(350);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid API key'),
    });

    await expect(callOpenAI(createMockOptions())).rejects.toThrow('OpenAI API error (401)');
  });
});

// =============================================================================
// Anthropic Tests
// =============================================================================

describe('callAnthropic', () => {
  it('sends correct request format with x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: 'Test response' }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
    });

    const opts = createMockOptions({ model: 'claude-sonnet-4-20250514' });
    await callAnthropic(opts);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01',
        },
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.system).toBe('You are a helpful assistant.');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('returns response with token usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: 'Claude analysis result' }],
          usage: { input_tokens: 120, output_tokens: 180 },
        }),
    });

    const result = await callAnthropic(createMockOptions());

    expect(result.content).toBe('Claude analysis result');
    expect(result.usage.inputTokens).toBe(120);
    expect(result.usage.outputTokens).toBe(180);
    expect(result.usage.totalTokens).toBe(300);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    });

    await expect(callAnthropic(createMockOptions())).rejects.toThrow('Anthropic API error (429)');
  });
});

// =============================================================================
// Gemini Tests
// =============================================================================

describe('callGemini', () => {
  it('sends API key in header, not URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Test response' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        }),
    });

    const opts = createMockOptions({ model: 'gemini-2.0-flash' });
    await callGemini(opts);

    // Verify URL does not contain API key
    const url = mockFetch.mock.calls[0][0];
    expect(url).not.toContain('key=');
    expect(url).toContain('gemini-2.0-flash');

    // Verify API key is in header
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['x-goog-api-key']).toBe('test-api-key');
  });

  it('does not include google_search tool when enableWebSearch is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Test response' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        }),
    });

    const opts = createMockOptions({ enableWebSearch: false });
    await callGemini(opts);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });

  it('does not include google_search tool when enableWebSearch is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Test response' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        }),
    });

    const opts = createMockOptions(); // enableWebSearch not set
    await callGemini(opts);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });

  it('includes google_search tool when enableWebSearch is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Test response with grounding' }] } }],
          usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 100 },
        }),
    });

    const opts = createMockOptions({ enableWebSearch: true });
    await callGemini(opts);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeDefined();
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]).toEqual({ google_search: {} });
  });

  it('returns response with token usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Gemini analysis result' }] } }],
          usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 150 },
        }),
    });

    const result = await callGemini(createMockOptions());

    expect(result.content).toBe('Gemini analysis result');
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.outputTokens).toBe(150);
    expect(result.usage.totalTokens).toBe(350);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Invalid request'),
    });

    await expect(callGemini(createMockOptions())).rejects.toThrow('Gemini API error (400)');
  });

  it('combines system prompt and user content into single message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 },
        }),
    });

    const opts = createMockOptions({
      systemPrompt: 'Be concise.',
      userContent: 'What is 2+2?',
    });
    await callGemini(opts);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toBe('Be concise.\n\nWhat is 2+2?');
  });
});

// =============================================================================
// Provider Dispatcher Tests
// =============================================================================

describe('callProvider', () => {
  it('routes to OpenAI for "openai" provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'OpenAI response' } }],
          usage: { prompt_tokens: 50, completion_tokens: 25 },
        }),
    });

    const result = await callProvider('openai', createMockOptions());

    expect(result.content).toBe('OpenAI response');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('routes to Anthropic for "anthropic" provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: 'Anthropic response' }],
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
    });

    const result = await callProvider('anthropic', createMockOptions());

    expect(result.content).toBe('Anthropic response');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('routes to Gemini for "gemini" provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 },
        }),
    });

    const result = await callProvider('gemini', createMockOptions({ model: 'gemini-2.0-flash' }));

    expect(result.content).toBe('Gemini response');
    expect(mockFetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  it('passes enableWebSearch to Gemini provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Grounded response' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 75 },
        }),
    });

    await callProvider('gemini', createMockOptions({ enableWebSearch: true }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ google_search: {} }]);
  });

  it('throws for unsupported provider', async () => {
    await expect(callProvider('unknown' as any, createMockOptions())).rejects.toThrow(
      'Unsupported AI provider: unknown'
    );
  });
});

// =============================================================================
// Token Usage Edge Cases
// =============================================================================

describe('token usage handling', () => {
  it('handles missing usage in OpenAI response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Response' } }],
          // No usage field
        }),
    });

    const result = await callOpenAI(createMockOptions());

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('handles missing usage in Anthropic response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: 'Response' }],
          // No usage field
        }),
    });

    const result = await callAnthropic(createMockOptions());

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('handles missing usageMetadata in Gemini response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          // No usageMetadata field
        }),
    });

    const result = await callGemini(createMockOptions());

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });
});
