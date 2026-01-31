/**
 * AI Paper Reviewer - Cost Tracking Tests
 * Tests for token usage tracking, cost calculation, and budget management
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
import {
  callOpenAI,
  callAnthropic,
  callGemini,
  type TokenUsage,
  type ProviderResponse,
} from '../../plugins/ai-paper-reviewer/lib/providers';

describe('Cost Tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Provider Token Usage Tests
  // ==========================================================================

  describe('Provider Token Usage', () => {
    describe('OpenAI', () => {
      it('should return token usage from OpenAI response', async () => {
        const mockResponse = {
          choices: [{ message: { content: '{"test": true}' } }],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 50,
          },
        };

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await callOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o',
          maxTokens: 4096,
          temperature: 0.3,
          systemPrompt: 'Test prompt',
          userContent: 'Test content',
        });

        expect(result.usage).toBeDefined();
        expect(result.usage.inputTokens).toBe(150);
        expect(result.usage.outputTokens).toBe(50);
        expect(result.usage.totalTokens).toBe(200);
      });

      it('should handle missing usage data gracefully', async () => {
        const mockResponse = {
          choices: [{ message: { content: '{"test": true}' } }],
          // No usage field
        };

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await callOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o',
          maxTokens: 4096,
          temperature: 0.3,
          systemPrompt: 'Test prompt',
          userContent: 'Test content',
        });

        expect(result.usage.inputTokens).toBe(0);
        expect(result.usage.outputTokens).toBe(0);
        expect(result.usage.totalTokens).toBe(0);
      });
    });

    describe('Anthropic', () => {
      it('should return token usage from Anthropic response', async () => {
        const mockResponse = {
          content: [{ text: '{"test": true}' }],
          usage: {
            input_tokens: 200,
            output_tokens: 100,
          },
        };

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await callAnthropic({
          apiKey: 'test-key',
          model: 'claude-sonnet-4-20250514',
          maxTokens: 4096,
          temperature: 0.3,
          systemPrompt: 'Test prompt',
          userContent: 'Test content',
        });

        expect(result.usage).toBeDefined();
        expect(result.usage.inputTokens).toBe(200);
        expect(result.usage.outputTokens).toBe(100);
        expect(result.usage.totalTokens).toBe(300);
      });
    });

    describe('Gemini', () => {
      it('should return token usage from Gemini response', async () => {
        const mockResponse = {
          candidates: [{ content: { parts: [{ text: '{"test": true}' }] } }],
          usageMetadata: {
            promptTokenCount: 180,
            candidatesTokenCount: 80,
          },
        };

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const result = await callGemini({
          apiKey: 'test-key',
          model: 'gemini-2.0-flash',
          maxTokens: 4096,
          temperature: 0.3,
          systemPrompt: 'Test prompt',
          userContent: 'Test content',
        });

        expect(result.usage).toBeDefined();
        expect(result.usage.inputTokens).toBe(180);
        expect(result.usage.outputTokens).toBe(80);
        expect(result.usage.totalTokens).toBe(260);
      });
    });
  });

  // ==========================================================================
  // callAiProvider Cost Tracking Tests
  // ==========================================================================

  describe('callAiProvider Cost Tracking', () => {
    it('should return usage and cost from AI analysis', async () => {
      const validAnalysis = {
        criteriaScores: { 'Content Quality': 4 },
        overallScore: 4,
        summary: 'Good submission',
        strengths: ['Well written'],
        weaknesses: ['Needs examples'],
        suggestions: ['Add code samples'],
        recommendation: 'ACCEPT',
        confidence: 0.85,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
          },
        }),
      } as Response);

      const { result, usage, costUsd } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', model: 'gpt-4o' },
        'Test submission text'
      );

      expect(usage).toBeDefined();
      expect(usage.inputTokens).toBe(1000);
      expect(usage.outputTokens).toBe(500);
      expect(usage.totalTokens).toBe(1500);

      expect(costUsd).toBeDefined();
      expect(costUsd).toBeGreaterThan(0);

      // Check result also has usage
      expect(result.usage).toBeDefined();
      expect(result.costUsd).toBeDefined();
    });

    it('should calculate correct cost for GPT-4o', async () => {
      const validAnalysis = {
        criteriaScores: {},
        overallScore: 3,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'NEUTRAL',
        confidence: 0.5,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
          usage: {
            prompt_tokens: 1000000, // 1M input tokens
            completion_tokens: 100000, // 100K output tokens
          },
        }),
      } as Response);

      const { costUsd } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', model: 'gpt-4o' },
        'Test'
      );

      // GPT-4o: $2.50/1M input + $10/1M output
      // 1M input = $2.50, 100K output = $1.00
      // Total = $3.50
      expect(costUsd).toBeCloseTo(3.5, 1);
    });

    it('should calculate correct cost for Claude Sonnet', async () => {
      const validAnalysis = {
        criteriaScores: {},
        overallScore: 3,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'NEUTRAL',
        confidence: 0.5,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(validAnalysis) }],
          usage: {
            input_tokens: 1000000, // 1M input tokens
            output_tokens: 100000, // 100K output tokens
          },
        }),
      } as Response);

      const { costUsd } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        'Test'
      );

      // Claude Sonnet 4: $3/1M input + $15/1M output
      // 1M input = $3.00, 100K output = $1.50
      // Total = $4.50
      expect(costUsd).toBeCloseTo(4.5, 1);
    });

    it('should use default pricing for unknown models', async () => {
      const validAnalysis = {
        criteriaScores: {},
        overallScore: 3,
        summary: 'Test',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        recommendation: 'NEUTRAL',
        confidence: 0.5,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
          },
        }),
      } as Response);

      const { costUsd } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', model: 'unknown-future-model' },
        'Test'
      );

      // Should use default pricing (conservative estimate)
      // Default: $5/1M input + $15/1M output
      expect(costUsd).toBeGreaterThan(0);
    });

    it('should accumulate tokens from repair attempts', async () => {
      // First call returns invalid JSON, second returns valid
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Main call - returns broken JSON
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: '{"broken": true' } }], // Invalid JSON
              usage: { prompt_tokens: 1000, completion_tokens: 200 },
            }),
          } as Response;
        } else {
          // Repair call
          const validAnalysis = {
            criteriaScores: {},
            overallScore: 3,
            summary: 'Test',
            strengths: [],
            weaknesses: [],
            suggestions: [],
            recommendation: 'NEUTRAL',
            confidence: 0.5,
          };
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
              usage: { prompt_tokens: 500, completion_tokens: 300 },
            }),
          } as Response;
        }
      });

      const { usage } = await callAiProvider(
        { apiKey: 'test-key', aiProvider: 'openai', model: 'gpt-4o' },
        'Test'
      );

      // Should include tokens from both calls
      expect(usage.inputTokens).toBe(1500); // 1000 + 500
      expect(usage.outputTokens).toBe(500); // 200 + 300
    });
  });

  // ==========================================================================
  // Budget Configuration Tests
  // ==========================================================================

  describe('Budget Configuration Schema', () => {
    it('should have budget settings in manifest', async () => {
      const manifest = await import('../../plugins/ai-paper-reviewer/manifest.json');
      const props = manifest.configSchema.properties;

      expect(props.budgetLimit).toBeDefined();
      expect(props.budgetLimit.type).toBe('number');
      expect(props.budgetLimit.default).toBe(0);
      expect(props.budgetLimit.minimum).toBe(0);

      expect(props.budgetAlertThreshold).toBeDefined();
      expect(props.budgetAlertThreshold.type).toBe('number');
      expect(props.budgetAlertThreshold.default).toBe(80);
      expect(props.budgetAlertThreshold.minimum).toBe(50);
      expect(props.budgetAlertThreshold.maximum).toBe(100);

      expect(props.pauseOnBudgetExceeded).toBeDefined();
      expect(props.pauseOnBudgetExceeded.type).toBe('boolean');
      expect(props.pauseOnBudgetExceeded.default).toBe(true);
    });

    it('should have budget group in x-groups', async () => {
      const manifest = await import('../../plugins/ai-paper-reviewer/manifest.json');
      const groups = manifest.configSchema['x-groups'];

      expect(groups.budget).toBeDefined();
      expect(groups.budget.title).toBe('Cost & Budget');
    });

    it('should have reset-budget action', async () => {
      const manifest = await import('../../plugins/ai-paper-reviewer/manifest.json');
      const actions = manifest.actions;

      const resetAction = actions.find((a: { name: string }) => a.name === 'reset-budget');
      expect(resetAction).toBeDefined();
      expect(resetAction.title).toBe('Reset Budget');
    });

    it('should have get-cost-stats action', async () => {
      const manifest = await import('../../plugins/ai-paper-reviewer/manifest.json');
      const actions = manifest.actions;

      const statsAction = actions.find((a: { name: string }) => a.name === 'get-cost-stats');
      expect(statsAction).toBeDefined();
      expect(statsAction.title).toBe('Get Cost Statistics');
    });
  });

  // ==========================================================================
  // Token Usage Type Tests
  // ==========================================================================

  describe('TokenUsage Type', () => {
    it('should have correct structure', () => {
      const usage: TokenUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
    });
  });

  describe('ProviderResponse Type', () => {
    it('should include content and usage', () => {
      const response: ProviderResponse = {
        content: '{"test": true}',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      };

      expect(response.content).toBeDefined();
      expect(response.usage).toBeDefined();
      expect(response.usage.totalTokens).toBe(150);
    });
  });
});
