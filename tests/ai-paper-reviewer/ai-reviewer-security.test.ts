/**
 * AI Paper Reviewer - Security Tests
 * Tests for prototype pollution protection, type validation, input limits, and API key handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Prisma before imports
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    pluginLog: { create: vi.fn().mockResolvedValue({}) },
    pluginJob: { create: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    pluginData: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/storage/local-storage-provider', () => ({
  getStorage: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/email/email-service', () => ({
  emailService: { send: vi.fn().mockResolvedValue({ success: true }) },
}));

import { callAiProvider } from '../../plugins/ai-paper-reviewer/index';

describe('AI Paper Reviewer Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Prototype Pollution Protection', () => {
    it('should reject __proto__ key in criteriaScores', async () => {
      const maliciousResponse = {
        criteriaScores: {
          '__proto__': { polluted: true },
          'Content Quality': 4,
        },
        overallScore: 4,
        summary: 'Test',
        strengths: ['Good'],
        weaknesses: ['Bad'],
        suggestions: ['Fix'],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // __proto__ should be filtered out
      expect(result.criteriaScores['__proto__']).toBeUndefined();
      expect(result.criteriaScores['Content Quality']).toBe(4);

      // Verify no prototype pollution occurred
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should reject prototype key in criteriaScores', async () => {
      const maliciousResponse = {
        criteriaScores: {
          'prototype': { polluted: true },
          'Relevance': 5,
        },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      expect(result.criteriaScores['prototype']).toBeUndefined();
      expect(result.criteriaScores['Relevance']).toBe(5);
    });

    it('should reject constructor key in criteriaScores', async () => {
      const maliciousResponse = {
        criteriaScores: {
          'constructor': { polluted: true },
          'Originality': 3,
        },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      expect(result.criteriaScores['constructor']).toBeUndefined();
      expect(result.criteriaScores['Originality']).toBe(3);
    });

    it('should handle criteriaScores as array (type confusion)', async () => {
      const maliciousResponse = {
        criteriaScores: [1, 2, 3], // Array instead of object
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should produce empty criteriaScores (arrays are rejected)
      expect(Object.keys(result.criteriaScores).length).toBe(0);
    });
  });

  describe('Type Validation / Prompt Injection Protection', () => {
    it('should handle recommendation as object (type confusion)', async () => {
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: { malicious: true }, // Object instead of string
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should default to 'NEUTRAL' since the value is not a string
      expect(result.recommendation).toBe('NEUTRAL');
    });

    it('should handle strengths as string instead of array', async () => {
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: 'This is a string not an array',
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should return empty array for non-array input
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(result.strengths.length).toBe(0);
    });

    it('should filter non-string elements from arrays', async () => {
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: ['Valid string', 123, { object: true }, null, 'Another valid'],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should only contain string elements
      expect(result.strengths).toEqual(['Valid string', 'Another valid']);
    });

    it('should handle non-numeric overallScore', async () => {
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 'five', // String instead of number
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should default to 3 for non-numeric input
      expect(result.overallScore).toBe(3);
    });

    it('should handle non-numeric confidence', async () => {
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 'high', // String instead of number
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should default to 0.8 for non-numeric input
      expect(result.confidence).toBe(0.8);
    });

    it('should reject non-numeric criteriaScores values', async () => {
      const maliciousResponse = {
        criteriaScores: {
          'Content Quality': 'good', // String instead of number
          'Relevance': 4, // Valid
          'Originality': { score: 5 }, // Object instead of number
        },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Only valid numeric scores should be included
      expect(result.criteriaScores['Content Quality']).toBeUndefined();
      expect(result.criteriaScores['Relevance']).toBe(4);
      expect(result.criteriaScores['Originality']).toBeUndefined();
    });

    it('should cap array sizes to prevent memory exhaustion', async () => {
      const largeArray = Array(100).fill('item');
      const maliciousResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: largeArray,
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(maliciousResponse) } }],
        }),
      } as Response);

      const { result } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Test submission'
      );

      // Should cap array at 20 elements
      expect(result.strengths.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Input Size Limits', () => {
    it('should truncate very long input text', async () => {
      const mockResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      } as Response);

      // Create input larger than default limit (50000 chars)
      const longInput = 'A'.repeat(60000);

      const { inputTruncated } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        longInput
      );

      expect(inputTruncated).toBe(true);

      // Verify the sent content was truncated
      const callBody = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
      );
      const sentContent = callBody.messages[1].content;
      expect(sentContent.length).toBeLessThan(60000);
      expect(sentContent).toContain('[Content truncated');
    });

    it('should respect configurable maxInputChars', async () => {
      const mockResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      } as Response);

      const { inputTruncated } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', maxInputChars: 5000 },
        'A'.repeat(10000)
      );

      expect(inputTruncated).toBe(true);
    });

    it('should not truncate input within limits', async () => {
      const mockResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      } as Response);

      const { inputTruncated } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai' },
        'Short input text'
      );

      expect(inputTruncated).toBe(false);
    });

    it('should use configurable maxTokens with upper bound', async () => {
      const mockResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      } as Response);

      // Try to set maxTokens above the limit
      await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', maxTokens: 100000 },
        'Test'
      );

      const callBody = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
      );

      // Should be capped at 16384
      expect(callBody.max_tokens).toBeLessThanOrEqual(16384);
    });
  });

  describe('Gemini API Key Security', () => {
    it('should send Gemini API key in header, not URL', async () => {
      const mockResponse = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'ACCEPT',
        confidence: 0.8,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResponse) }] } }],
        }),
      } as Response);

      await callAiProvider(
        { apiKey: 'secret-gemini-key', aiProvider: 'gemini', model: 'gemini-1.5-pro' },
        'Test submission'
      );

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const url = callArgs[0] as string;
      const options = callArgs[1] as RequestInit;
      const headers = options.headers as Record<string, string>;

      // API key should NOT be in URL
      expect(url).not.toContain('secret-gemini-key');
      expect(url).not.toContain('key=');

      // API key SHOULD be in header
      expect(headers['x-goog-api-key']).toBe('secret-gemini-key');
    });
  });
});

describe('JSON Repair Error Messages', () => {
  it('should not include raw response in error messages', async () => {
    const { parseWithRetry } = await import('../../plugins/ai-paper-reviewer/lib/json-repair');

    const sensitiveData = 'This contains sensitive API_KEY=secret123 data';
    const mockRepairFn = vi.fn().mockResolvedValue('still invalid');

    try {
      await parseWithRetry(sensitiveData, mockRepairFn, 1);
      expect.fail('Should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      // Should NOT contain the raw sensitive data
      expect(message).not.toContain('API_KEY');
      expect(message).not.toContain('secret123');
      // Should contain generic info about the failure
      expect(message).toContain('Failed to parse JSON');
      expect(message).toContain('chars'); // Length info instead of content
    }
  });
});
