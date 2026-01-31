/**
 * AI Paper Reviewer Plugin
 *
 * Automatically analyzes paper submissions using AI to provide
 * preliminary reviews with scoring, feedback, and recommendations.
 *
 * v1.1.0: Event-aware criteria, duplicate detection, Gemini support,
 * confidence thresholds, and JSON repair.
 */

import type { Plugin, PluginContext, PluginManifest } from '@/lib/plugins';
import { AiReviewPanel } from './components/ai-review-panel';
import { AiReviewerSidebarItem } from './components/admin-sidebar-item';
import { AdminDashboard } from './components/admin-dashboard';
import { AdminReviewHistory } from './components/admin-review-history';
import { AdminPersonas } from './components/admin-personas';
import { buildSystemPrompt } from './lib/prompts';
import type { ReviewCriterion, SimilarSubmissionInfo, EventContext } from './lib/prompts';
import { callProvider, type TokenUsage } from './lib/providers';
import { parseWithRetry } from './lib/json-repair';
import { findSimilarSubmissions } from './lib/similarity';
import type { SimilarSubmission } from './lib/similarity';
import { fetchModelsForProvider } from './lib/model-fetcher';
import type { FetchModelsResult } from './lib/model-fetcher';
import manifestJson from './manifest.json';

const manifest: PluginManifest = manifestJson as PluginManifest;

// =============================================================================
// CONFIGURATION
// =============================================================================

interface AiReviewerConfig {
  aiProvider?: 'openai' | 'anthropic' | 'gemini';
  apiKey?: string;
  model?: string;
  temperature?: number;
  autoReview?: boolean;
  useEventCriteria?: boolean;
  strictnessLevel?: 'lenient' | 'moderate' | 'strict';
  /** Custom persona - managed via the Personas page, not settings form */
  customPersona?: string;
  /** Review focus areas - internal use */
  reviewFocus?: string[];
  enableDuplicateDetection?: boolean;
  duplicateThreshold?: number;
  confidenceThreshold?: number;
  /** Show AI reviewer on public team/reviewers page */
  showAiReviewerOnTeamPage?: boolean;
  /** Re-review cooldown in minutes */
  reReviewCooldownMinutes?: number;
  /** Maximum output tokens for AI response (default: 4096, max: 16384) */
  maxTokens?: number;
  /** Maximum input characters for submission text (default: 50000, max: 100000) */
  maxInputChars?: number;
  /** Monthly budget limit in USD (0 = unlimited) */
  budgetLimit?: number;
  /** Budget alert threshold (percentage, 0-100) */
  budgetAlertThreshold?: number;
  /** Pause auto-reviews when budget exceeded */
  pauseOnBudgetExceeded?: boolean;
}

// =============================================================================
// SECURITY CONSTANTS
// =============================================================================

/** Default and maximum limits for AI requests to prevent cost/resource abuse */
const AI_LIMITS = {
  DEFAULT_MAX_TOKENS: 4096,
  MAX_MAX_TOKENS: 16384,
  DEFAULT_MAX_INPUT_CHARS: 50000,
  MAX_MAX_INPUT_CHARS: 100000,
} as const;

/** Limits for background processing to prevent resource exhaustion */
const PROCESSING_LIMITS = {
  /** Maximum pending jobs to scan when cancelling superseded jobs */
  MAX_PENDING_JOBS_TO_SCAN: 100,
  /** Maximum submissions to consider for duplicate detection */
  MAX_SUBMISSIONS_FOR_SIMILARITY: 500,
  /** Maximum abstract length used for similarity tokenization */
  MAX_ABSTRACT_LENGTH_FOR_SIMILARITY: 10000,
} as const;

// =============================================================================
// COST TRACKING
// =============================================================================

/**
 * Pricing per 1M tokens (in USD) for various models.
 * These are approximate prices as of early 2025.
 * Users can check their provider dashboard for actual costs.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  // Anthropic
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-haiku-4-20250514': { input: 0.80, output: 4.00 },
  // Gemini
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-pro': { input: 0.50, output: 1.50 },
};

/** Default pricing for unknown models (conservative estimate) */
const DEFAULT_PRICING = { input: 5.00, output: 15.00 };

/**
 * Calculate cost in USD from token usage and model
 */
function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Cost tracking data stored per billing period
 */
interface CostStats {
  totalSpend: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  reviewCount: number;
  periodStart: string;
  lastUpdated: string;
}

// =============================================================================
// ANALYSIS RESULT TYPE
// =============================================================================

export interface AiAnalysisResult {
  criteriaScores: Record<string, number>;
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  recommendation: string;
  confidence: number;
  similarSubmissions?: SimilarSubmission[];
  rawResponse?: string; // only present during processing, stripped before storage
  parseAttempts: number;
  repairApplied: boolean;
  analyzedAt: string;
  // Cost tracking (v1.14.0+)
  usage?: TokenUsage;
  costUsd?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Speaker info for submission text
 * NOTE: Email is intentionally excluded for privacy - only public info is sent to AI
 */
interface SpeakerInfo {
  name: string | null;
  bio: string | null;
  speakingExperience: string | null;
  experienceLevel: string | null;
  company: string | null;
  position: string | null;
  expertiseTags: string[];
  // Social handles (public info, safe to share with AI)
  linkedinUrl: string | null;
  twitterHandle: string | null;
  githubUsername: string | null;
  websiteUrl: string | null;
}

/**
 * Co-speaker info for submission text
 */
interface CoSpeakerInfo {
  name: string;
  bio: string | null;
}

/**
 * Build submission text for AI analysis from a submission object
 */
export function buildSubmissionText(submission: {
  title: string;
  abstract: string | null;
  outline?: string | null;
  targetAudience?: string | null;
  prerequisites?: string | null;
  speaker?: SpeakerInfo | null;
  coSpeakers?: CoSpeakerInfo[];
}): string {
  const parts = [`Title: ${submission.title}`];

  if (submission.abstract) {
    parts.push(`\nAbstract:\n${submission.abstract}`);
  }
  if (submission.outline) {
    parts.push(`\nOutline:\n${submission.outline}`);
  }
  if (submission.targetAudience) {
    parts.push(`\nTarget Audience: ${submission.targetAudience}`);
  }
  if (submission.prerequisites) {
    parts.push(`\nPrerequisites: ${submission.prerequisites}`);
  }

  // Add speaker information section
  if (submission.speaker) {
    const speaker = submission.speaker;
    const speakerParts: string[] = [];

    if (speaker.name) {
      speakerParts.push(`Name: ${speaker.name}`);
    }
    if (speaker.position && speaker.company) {
      speakerParts.push(`Role: ${speaker.position} at ${speaker.company}`);
    } else if (speaker.position) {
      speakerParts.push(`Role: ${speaker.position}`);
    } else if (speaker.company) {
      speakerParts.push(`Company: ${speaker.company}`);
    }
    if (speaker.experienceLevel) {
      const levelLabels: Record<string, string> = {
        NEW: 'First-time speaker',
        EXPERIENCED: 'Experienced speaker (several talks at meetups/conferences)',
        PROFESSIONAL: 'Professional speaker (regular at conferences)',
        KEYNOTE: 'Keynote speaker level',
      };
      speakerParts.push(`Experience Level: ${levelLabels[speaker.experienceLevel] || speaker.experienceLevel}`);
    }
    if (speaker.expertiseTags && speaker.expertiseTags.length > 0) {
      speakerParts.push(`Expertise Areas: ${speaker.expertiseTags.join(', ')}`);
    }

    // Social profiles (public info for AI to assess speaker credibility)
    const socialLinks: string[] = [];
    if (speaker.linkedinUrl) {
      socialLinks.push(`LinkedIn: ${speaker.linkedinUrl}`);
    }
    if (speaker.twitterHandle) {
      socialLinks.push(`Twitter/X: @${speaker.twitterHandle}`);
    }
    if (speaker.githubUsername) {
      socialLinks.push(`GitHub: ${speaker.githubUsername}`);
    }
    if (speaker.websiteUrl) {
      socialLinks.push(`Website: ${speaker.websiteUrl}`);
    }
    if (socialLinks.length > 0) {
      speakerParts.push(`Social Profiles: ${socialLinks.join(', ')}`);
    }

    if (speaker.bio) {
      speakerParts.push(`Bio: ${speaker.bio}`);
    }
    if (speaker.speakingExperience) {
      speakerParts.push(`Speaking Experience: ${speaker.speakingExperience}`);
    }

    if (speakerParts.length > 0) {
      parts.push(`\n--- PRIMARY SPEAKER ---\n${speakerParts.join('\n')}`);
    }
  }

  // Add co-speaker information
  if (submission.coSpeakers && submission.coSpeakers.length > 0) {
    const coSpeakerParts: string[] = [];
    for (let i = 0; i < submission.coSpeakers.length; i++) {
      const coSpeaker = submission.coSpeakers[i];
      const coSpeakerInfo: string[] = [`Name: ${coSpeaker.name}`];
      if (coSpeaker.bio) {
        coSpeakerInfo.push(`Bio: ${coSpeaker.bio}`);
      }
      coSpeakerParts.push(`Co-Speaker ${i + 1}:\n${coSpeakerInfo.join('\n')}`);
    }
    parts.push(`\n--- CO-SPEAKERS ---\n${coSpeakerParts.join('\n\n')}`);
  }

  return parts.join('\n');
}

/**
 * Call the AI provider API to analyze a submission.
 * Now uses the provider module, temperature, and parseWithRetry.
 * Returns token usage and cost for tracking (v1.14.0+).
 */
export async function callAiProvider(
  config: AiReviewerConfig,
  submissionText: string,
  systemPrompt?: string
): Promise<{ result: AiAnalysisResult; rawResponse: string; inputTruncated: boolean; usage: TokenUsage; costUsd: number }> {
  const provider = config.aiProvider || 'openai';
  const model = config.model || 'gpt-4o';

  // Security: Configurable maxTokens with enforced upper bound to prevent cost abuse
  const configuredMaxTokens = config.maxTokens ?? AI_LIMITS.DEFAULT_MAX_TOKENS;
  const maxTokens = Math.min(Math.max(100, configuredMaxTokens), AI_LIMITS.MAX_MAX_TOKENS);

  // Security: Enforce input size limit to prevent resource exhaustion
  const configuredMaxInput = config.maxInputChars ?? AI_LIMITS.DEFAULT_MAX_INPUT_CHARS;
  const maxInputChars = Math.min(Math.max(1000, configuredMaxInput), AI_LIMITS.MAX_MAX_INPUT_CHARS);

  let inputTruncated = false;
  let processedText = submissionText;
  if (submissionText.length > maxInputChars) {
    processedText = submissionText.slice(0, maxInputChars) + '\n\n[Content truncated due to length limit]';
    inputTruncated = true;
  }

  const temperature = config.temperature ?? 0.3;
  const prompt = systemPrompt || buildSystemPrompt();

  // Track total usage across main call and potential repair calls
  let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  const providerResponse = await callProvider(provider, {
    apiKey: config.apiKey!,
    model,
    maxTokens,
    temperature,
    systemPrompt: prompt,
    userContent: processedText,
  });

  const rawResponse = providerResponse.content;
  totalUsage.inputTokens += providerResponse.usage.inputTokens;
  totalUsage.outputTokens += providerResponse.usage.outputTokens;
  totalUsage.totalTokens += providerResponse.usage.totalTokens;

  // Create a repair function that asks the AI to fix broken JSON
  const repairFn = async (broken: string): Promise<string> => {
    const repairResponse = await callProvider(provider, {
      apiKey: config.apiKey!,
      model,
      maxTokens,
      temperature: 0,
      systemPrompt: 'Fix this JSON so it is valid. Return ONLY the corrected JSON, nothing else.',
      userContent: broken,
    });
    // Track repair call usage
    totalUsage.inputTokens += repairResponse.usage.inputTokens;
    totalUsage.outputTokens += repairResponse.usage.outputTokens;
    totalUsage.totalTokens += repairResponse.usage.totalTokens;
    return repairResponse.content;
  };

  const { data: parsed, parseAttempts, repairApplied } = await parseWithRetry<RawAiResponse>(
    rawResponse,
    repairFn
  );

  // Normalize scores - keep one decimal place for accuracy
  const clamp = (v: number) => Math.round(Math.max(1, Math.min(5, v)) * 10) / 10;

  // Security: Dangerous keys that could cause prototype pollution
  const DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'];

  // Security: Use Object.create(null) to prevent prototype pollution
  const criteriaScores: Record<string, number> = Object.create(null);
  if (parsed.criteriaScores && typeof parsed.criteriaScores === 'object' && !Array.isArray(parsed.criteriaScores)) {
    for (const [name, score] of Object.entries(parsed.criteriaScores)) {
      // Security: Reject dangerous keys that could pollute prototype
      if (DANGEROUS_KEYS.includes(name)) {
        continue;
      }
      // Security: Validate score is actually a number
      if (typeof score === 'number' && !isNaN(score)) {
        criteriaScores[name] = clamp(score);
      }
    }
  }

  // Backward compat: if old-style fixed scores exist, use them
  if (Object.keys(criteriaScores).length === 0) {
    if (typeof parsed.contentScore === 'number') criteriaScores['Content Quality'] = clamp(parsed.contentScore);
    if (typeof parsed.presentationScore === 'number') criteriaScores['Presentation Clarity'] = clamp(parsed.presentationScore);
    if (typeof parsed.relevanceScore === 'number') criteriaScores['Relevance'] = clamp(parsed.relevanceScore);
    if (typeof parsed.originalityScore === 'number') criteriaScores['Originality'] = clamp(parsed.originalityScore);
  }

  // Security: Validate and sanitize AI response fields to prevent type confusion
  const validateStringArray = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((item): item is string => typeof item === 'string').slice(0, 20); // Cap array size
  };

  const validateString = (val: unknown, defaultVal: string): string => {
    return typeof val === 'string' ? val.slice(0, 10000) : defaultVal; // Cap string length
  };

  // Calculate cost based on usage and model
  const costUsd = calculateCost(totalUsage, model);

  const result: AiAnalysisResult = {
    criteriaScores,
    overallScore: typeof parsed.overallScore === 'number' ? clamp(parsed.overallScore) : 3,
    summary: validateString(parsed.summary, ''),
    strengths: validateStringArray(parsed.strengths),
    weaknesses: validateStringArray(parsed.weaknesses),
    suggestions: validateStringArray(parsed.suggestions),
    recommendation: validateString(parsed.recommendation, 'NEUTRAL'),
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8,
    rawResponse,
    parseAttempts,
    repairApplied,
    analyzedAt: new Date().toISOString(),
    usage: totalUsage,
    costUsd,
  };

  return { result, rawResponse, inputTruncated, usage: totalUsage, costUsd };
}

/** Raw shape the AI might return (flexible) */
interface RawAiResponse {
  criteriaScores?: Record<string, number>;
  contentScore?: number;
  presentationScore?: number;
  relevanceScore?: number;
  originalityScore?: number;
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  recommendation?: string;
  confidence?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default re-review cooldown in milliseconds (5 minutes) */
const DEFAULT_RE_REVIEW_COOLDOWN_MS = 5 * 60 * 1000;

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

const plugin: Plugin = {
  manifest,

  async onEnable(ctx: PluginContext) {
    const config = ctx.config as AiReviewerConfig;

    // Register job handler for AI reviews
    ctx.logger.info('Attempting to register job handler', { hasJobs: !!ctx.jobs });
    if (ctx.jobs) {
      try {
        ctx.jobs.registerHandler('ai-review', async (payload) => {
          return handleAiReviewJob(payload, ctx);
        });
        ctx.logger.info('Registered ai-review job handler successfully');
      } catch (err) {
        ctx.logger.error('Failed to register job handler', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      ctx.logger.error('ctx.jobs is undefined - cannot register job handler');
    }

    // Create or retrieve the AI reviewer service account
    try {
      const serviceAccount = await ctx.users.createServiceAccount({
        name: 'AI Paper Reviewer',
        image: '/images/ai-reviewer-avatar.png', // Optional: plugin can provide its own avatar
      });

      // Store the service account ID for use in reviews
      await ctx.data.set('config', 'service-account-id', serviceAccount.id);

      // Security: Don't log email - only log ID
      ctx.logger.info('AI Paper Reviewer service account ready', {
        userId: serviceAccount.id,
      });
    } catch (error) {
      ctx.logger.error('Failed to create service account', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Store API key configuration status (password fields are redacted on client)
    const hasApiKey = Boolean(config.apiKey);
    await ctx.data.set('config', 'api-key-configured', hasApiKey);

    if (!hasApiKey) {
      ctx.logger.warn('AI Paper Reviewer enabled without an API key - reviews will fail until configured');
    } else {
      ctx.logger.info('AI Paper Reviewer enabled', {
        provider: config.aiProvider || 'openai',
        model: config.model || 'gpt-4o',
        autoReview: config.autoReview !== false,
      });
    }
  },

  async onDisable(ctx: PluginContext) {
    // Unregister job handler
    if (ctx.jobs) {
      ctx.jobs.unregisterHandler('ai-review');
      ctx.logger.debug('Unregistered ai-review job handler');
    }
    ctx.logger.info('AI Paper Reviewer disabled');
  },

  hooks: {
    'submission.created': async (ctx, payload) => {
      const config = ctx.config as AiReviewerConfig;

      // Update API key configuration status (for dashboard display)
      const hasApiKey = Boolean(config.apiKey);
      await ctx.data.set('config', 'api-key-configured', hasApiKey);

      if (config.autoReview === false) {
        ctx.logger.debug('Auto-review disabled, skipping AI analysis', {
          submissionId: payload.submission.id,
        });
        return;
      }

      if (!hasApiKey) {
        ctx.logger.warn('Cannot run AI review - no API key configured');
        return;
      }

      ctx.logger.info('Queuing AI review for new submission', {
        submissionId: payload.submission.id,
        title: payload.submission.title,
      });

      await ctx.jobs!.enqueue({
        type: 'ai-review',
        payload: {
          submissionId: payload.submission.id,
          eventId: payload.event.id,
          eventSlug: payload.event.slug,
          title: payload.submission.title,
          abstract: payload.submission.abstract,
          outline: (payload.submission as Record<string, unknown>).outline || null,
          targetAudience: (payload.submission as Record<string, unknown>).targetAudience || null,
          prerequisites: (payload.submission as Record<string, unknown>).prerequisites || null,
        },
      });
    },

    'submission.updated': async (ctx, payload) => {
      const config = ctx.config as AiReviewerConfig;

      // Update API key configuration status (for dashboard display)
      const hasApiKey = Boolean(config.apiKey);
      await ctx.data.set('config', 'api-key-configured', hasApiKey);

      const hasContentChanges =
        payload.changes.abstract !== undefined ||
        payload.changes.title !== undefined ||
        payload.changes.outline !== undefined;

      if (!hasContentChanges) return;
      if (config.autoReview === false || !hasApiKey) return;

      const submissionId = payload.submission.id;

      // Check cooldown: skip if last review was too recent
      const cooldownMs =
        ((config as Record<string, unknown>).reReviewCooldownMinutes as number | undefined)
          ? ((config as Record<string, unknown>).reReviewCooldownMinutes as number) * 60 * 1000
          : DEFAULT_RE_REVIEW_COOLDOWN_MS;

      const lastReviewKey = `last-review-${submissionId}`;
      const lastReviewTime = await ctx.data.get<number>('reviews', lastReviewKey);

      if (lastReviewTime && Date.now() - lastReviewTime < cooldownMs) {
        ctx.logger.debug('Skipping re-review: within cooldown period', {
          submissionId,
          cooldownMs,
          lastReviewAge: Date.now() - lastReviewTime,
        });
        return;
      }

      // Cancel any existing pending ai-review jobs for this submission
      // SECURITY: Limit jobs scanned to prevent resource exhaustion on large queues
      try {
        const pendingJobs = await ctx.jobs!.getJobs('pending');
        const jobsToScan = pendingJobs.slice(0, PROCESSING_LIMITS.MAX_PENDING_JOBS_TO_SCAN);
        for (const job of jobsToScan) {
          if (
            job.type === 'ai-review' &&
            (job.payload as Record<string, unknown>)?.submissionId === submissionId
          ) {
            await ctx.jobs!.cancelJob(job.id);
            ctx.logger.debug('Cancelled superseded pending ai-review job', {
              jobId: job.id,
              submissionId,
            });
          }
        }
        if (pendingJobs.length > PROCESSING_LIMITS.MAX_PENDING_JOBS_TO_SCAN) {
          ctx.logger.warn('Job queue exceeds scan limit, some jobs may not be cancelled', {
            queueSize: pendingJobs.length,
            scanned: PROCESSING_LIMITS.MAX_PENDING_JOBS_TO_SCAN,
          });
        }
      } catch {
        ctx.logger.warn('Failed to cancel existing pending jobs for submission', { submissionId });
      }

      // Record enqueue timestamp
      await ctx.data.set('reviews', lastReviewKey, Date.now());

      ctx.logger.info('Queuing AI re-review for updated submission', {
        submissionId,
      });

      // Get event slug for linking
      const eventId = (payload.submission as Record<string, unknown>).eventId as string | null;
      let eventSlug: string | null = null;
      if (eventId) {
        try {
          const event = await ctx.events.get(eventId);
          eventSlug = event?.slug || null;
        } catch {
          ctx.logger.warn('Could not fetch event slug for submission update');
        }
      }

      await ctx.jobs!.enqueue({
        type: 'ai-review',
        payload: {
          submissionId,
          eventId,
          eventSlug,
          title: payload.submission.title,
          abstract: payload.submission.abstract,
          outline: (payload.submission as Record<string, unknown>).outline || null,
          targetAudience: (payload.submission as Record<string, unknown>).targetAudience || null,
          prerequisites: (payload.submission as Record<string, unknown>).prerequisites || null,
          isReReview: true,
        },
      });
    },
  },

  components: [
    {
      slot: 'submission.review.panel',
      component: AiReviewPanel,
      order: 50,
    },
    {
      slot: 'admin.sidebar.items',
      component: AiReviewerSidebarItem,
      order: 100,
    },
  ],

  adminPages: [
    {
      path: '/',
      title: 'Dashboard',
      component: AdminDashboard,
    },
    {
      path: '/history',
      title: 'Review History',
      component: AdminReviewHistory,
    },
    {
      path: '/personas',
      title: 'Reviewer Personas',
      component: AdminPersonas,
    },
  ],

  actions: {
    'list-models': async (
      ctx: PluginContext,
      params: { provider?: string }
    ): Promise<FetchModelsResult> => {
      const config = ctx.config as AiReviewerConfig;
      const provider = params.provider || config.aiProvider || 'openai';
      // SECURITY: Only use server-side config.apiKey - never accept API keys via params
      // This prevents API keys from being logged in request bodies/action params
      const apiKey = config.apiKey;

      if (!apiKey) {
        return {
          success: false,
          error: {
            code: 'NO_API_KEY',
            message: 'Please save your API key in plugin settings first',
          },
        };
      }

      const result = await fetchModelsForProvider(provider, apiKey);

      // Only log failures - success logs were too noisy
      if (!result.success) {
        ctx.logger.warn('Failed to fetch models', {
          provider,
          error: result.error?.message,
        });
      }

      return result;
    },

    'clear-reviews': async (
      ctx: PluginContext,
      _params: Record<string, unknown>
    ): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
      try {
        // Get the service account ID
        const serviceAccountId = await ctx.data.get<string>('config', 'service-account-id');

        if (!serviceAccountId) {
          return { success: false, error: 'AI reviewer service account not found' };
        }

        ctx.logger.info('Clearing all AI reviews', { serviceAccountId });

        // Get all reviews from the AI reviewer
        const allReviews = await ctx.reviews.list({ reviewerId: serviceAccountId });

        let deletedCount = 0;
        for (const review of allReviews) {
          try {
            await ctx.reviews.delete(review.id);
            deletedCount++;
          } catch (err) {
            ctx.logger.warn('Failed to delete review', {
              reviewId: review.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Also clear job history for this plugin
        try {
          const pendingJobs = await ctx.jobs!.getJobs('pending');
          const completedJobs = await ctx.jobs!.getJobs('completed');
          const failedJobs = await ctx.jobs!.getJobs('failed');

          const allJobs = [...pendingJobs, ...completedJobs, ...failedJobs];
          for (const job of allJobs) {
            if (job.type === 'ai-review') {
              try {
                await ctx.jobs!.cancelJob(job.id);
              } catch {
                // Job might already be completed/cancelled
              }
            }
          }
        } catch {
          ctx.logger.warn('Failed to clear job history');
        }

        ctx.logger.info('Cleared AI reviews', { deletedCount });

        return { success: true, deletedCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Failed to clear AI reviews', { error: message });
        return { success: false, error: message };
      }
    },

    'delete-review': async (
      ctx: PluginContext,
      params: { reviewId?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      const { reviewId } = params;

      if (!reviewId) {
        return { success: false, error: 'Review ID is required' };
      }

      try {
        // Get the service account ID to verify this is an AI review
        const serviceAccountId = await ctx.data.get<string>('config', 'service-account-id');

        if (!serviceAccountId) {
          return { success: false, error: 'AI reviewer service account not found' };
        }

        // Security/Performance: Fetch review by ID directly instead of listing all reviews
        // Use the reviews.get method if available, otherwise use targeted list
        let review;
        if (typeof ctx.reviews.get === 'function') {
          review = await ctx.reviews.get(reviewId);
        } else {
          // Fallback: use list with reviewerId filter for efficiency
          const aiReviews = await ctx.reviews.list({ reviewerId: serviceAccountId });
          review = aiReviews.find(r => r.id === reviewId);
        }

        if (!review) {
          return { success: false, error: 'Review not found' };
        }

        // Security: Only verify by reviewerId, not content pattern (which can be spoofed)
        if (review.reviewerId !== serviceAccountId) {
          return { success: false, error: 'Can only delete AI-generated reviews' };
        }

        await ctx.reviews.delete(reviewId);
        ctx.logger.info('Deleted AI review', { reviewId });

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Failed to delete AI review', { reviewId, error: message });
        return { success: false, error: message };
      }
    },

    'reset-budget': async (
      ctx: PluginContext,
      _params: Record<string, unknown>
    ): Promise<{ success: boolean; previousSpend?: number; error?: string }> => {
      try {
        const existingStats = await ctx.data.get<CostStats>('costs', 'current-period');
        const previousSpend = existingStats?.totalSpend ?? 0;

        const now = new Date().toISOString();
        const newStats: CostStats = {
          totalSpend: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          reviewCount: 0,
          periodStart: now,
          lastUpdated: now,
        };

        await ctx.data.set('costs', 'current-period', newStats);

        ctx.logger.info('Budget reset', { previousSpend });

        return { success: true, previousSpend };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Failed to reset budget', { error: message });
        return { success: false, error: message };
      }
    },

    'get-cost-stats': async (
      ctx: PluginContext,
      _params: Record<string, unknown>
    ): Promise<{
      success: boolean;
      stats?: CostStats & {
        budgetLimit: number;
        budgetRemaining: number;
        budgetUsedPercent: number;
        averageCostPerReview: number;
      };
      error?: string;
    }> => {
      try {
        const config = ctx.config as AiReviewerConfig;
        const budgetLimit = config.budgetLimit ?? 0;

        const existingStats = await ctx.data.get<CostStats>('costs', 'current-period');

        const stats: CostStats = existingStats ?? {
          totalSpend: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          reviewCount: 0,
          periodStart: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        const budgetRemaining = budgetLimit > 0 ? Math.max(0, budgetLimit - stats.totalSpend) : -1;
        const budgetUsedPercent = budgetLimit > 0 ? (stats.totalSpend / budgetLimit) * 100 : 0;
        const averageCostPerReview = stats.reviewCount > 0 ? stats.totalSpend / stats.reviewCount : 0;

        return {
          success: true,
          stats: {
            ...stats,
            budgetLimit,
            budgetRemaining,
            budgetUsedPercent,
            averageCostPerReview,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Failed to get cost stats', { error: message });
        return { success: false, error: message };
      }
    },
  },
};

export default plugin;

/**
 * Job handler for AI review processing.
 * This is exported separately so it can be registered with the worker.
 */
export async function handleAiReviewJob(
  payload: Record<string, unknown>,
  ctx: PluginContext
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const config = ctx.config as AiReviewerConfig;
  const submissionId = payload.submissionId as string;
  let eventId = payload.eventId as string | undefined;

  ctx.logger.info('Processing AI review job', { submissionId, isReReview: payload.isReReview });

  // For re-reviews or when abstract is missing, fetch full submission data
  // NOTE: Email is intentionally excluded for privacy - only public info is sent to AI
  let submissionData: {
    title: string;
    abstract: string | null;
    outline: string | null;
    targetAudience: string | null;
    prerequisites: string | null;
    speaker: SpeakerInfo | null;
    coSpeakers: CoSpeakerInfo[];
  } = {
    title: payload.title as string,
    abstract: payload.abstract as string | null,
    outline: payload.outline as string | null,
    targetAudience: payload.targetAudience as string | null,
    prerequisites: payload.prerequisites as string | null,
    speaker: null,
    coSpeakers: [],
  };

  // Always fetch submission data with speaker info to ensure we have complete info
  try {
    // Use getWithSpeakers if available (API v1.12.0+), fallback to get
    const submission = typeof ctx.submissions.getWithSpeakers === 'function'
      ? await ctx.submissions.getWithSpeakers(submissionId)
      : await ctx.submissions.get(submissionId);

    // Security: Don't log content previews - only log metadata
    ctx.logger.info('Submission fetch result', {
      submissionId,
      found: !!submission,
      hasAbstract: !!submission?.abstract,
      abstractLength: submission?.abstract?.length || 0,
      hasSpeakerInfo: !!(submission && 'speaker' in submission && submission.speaker),
      coSpeakerCount: (submission && 'coSpeakers' in submission) ? (submission.coSpeakers as unknown[]).length : 0,
    });

    if (submission) {
      submissionData = {
        title: submission.title,
        abstract: submission.abstract,
        outline: (submission as Record<string, unknown>).outline as string | null,
        targetAudience: (submission as Record<string, unknown>).targetAudience as string | null,
        prerequisites: (submission as Record<string, unknown>).prerequisites as string | null,
        speaker: null,
        coSpeakers: [],
      };

      // Extract speaker info if available (from getWithSpeakers)
      // NOTE: Email is intentionally excluded for privacy - only public info is sent to AI
      if ('speaker' in submission && submission.speaker) {
        const speaker = submission.speaker as {
          name?: string | null;
          profile?: {
            fullName?: string | null;
            bio?: string | null;
            speakingExperience?: string | null;
            experienceLevel?: string | null;
            company?: string | null;
            position?: string | null;
            expertiseTags?: string[];
            linkedinUrl?: string | null;
            twitterHandle?: string | null;
            githubUsername?: string | null;
            websiteUrl?: string | null;
          } | null;
        };
        submissionData.speaker = {
          name: speaker.profile?.fullName || speaker.name || null,
          bio: speaker.profile?.bio || null,
          speakingExperience: speaker.profile?.speakingExperience || null,
          experienceLevel: speaker.profile?.experienceLevel || null,
          company: speaker.profile?.company || null,
          position: speaker.profile?.position || null,
          expertiseTags: speaker.profile?.expertiseTags || [],
          linkedinUrl: speaker.profile?.linkedinUrl || null,
          twitterHandle: speaker.profile?.twitterHandle || null,
          githubUsername: speaker.profile?.githubUsername || null,
          websiteUrl: speaker.profile?.websiteUrl || null,
        };
      }

      // Extract co-speaker info if available
      if ('coSpeakers' in submission && Array.isArray(submission.coSpeakers)) {
        submissionData.coSpeakers = (submission.coSpeakers as Array<{ name: string; bio?: string | null }>).map((cs) => ({
          name: cs.name,
          bio: cs.bio || null,
        }));
      }

      // Also get eventId from submission if not provided
      if (!eventId) {
        eventId = submission.eventId;
      }
    }
  } catch (err) {
    ctx.logger.warn('Failed to fetch submission', {
      submissionId,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Update API key configuration status (for dashboard display)
  const hasApiKey = Boolean(config.apiKey);
  await ctx.data.set('config', 'api-key-configured', hasApiKey);

  // Check for API key early and return a clear error
  if (!hasApiKey) {
    ctx.logger.error('AI review failed - no API key configured', { submissionId });
    return { success: false, error: 'API key not configured. Please add your API key in the plugin settings.' };
  }

  // Check budget limit before proceeding (only if budget is set and pause is enabled)
  const budgetLimit = config.budgetLimit ?? 0;
  const pauseOnBudgetExceeded = config.pauseOnBudgetExceeded !== false; // default true

  if (budgetLimit > 0 && pauseOnBudgetExceeded) {
    const costStats = await ctx.data.get<CostStats>('costs', 'current-period');
    const currentSpend = costStats?.totalSpend ?? 0;

    if (currentSpend >= budgetLimit) {
      ctx.logger.warn('AI review skipped - budget limit exceeded', {
        submissionId,
        currentSpend,
        budgetLimit,
      });
      return {
        success: false,
        error: `Budget limit ($${budgetLimit.toFixed(2)}) exceeded. Current spend: $${currentSpend.toFixed(2)}. Reset budget from the dashboard to continue.`,
      };
    }
  }

  try {
    // 1. Fetch event criteria if useEventCriteria is enabled
    let criteria: ReviewCriterion[] = [];
    let eventContext: EventContext | null = null;

    if (eventId && config.useEventCriteria !== false) {
      try {
        const eventWithCriteria = await ctx.events.getWithCriteria(eventId);
        if (eventWithCriteria) {
          eventContext = {
            name: eventWithCriteria.name,
            description: eventWithCriteria.description,
            eventType: eventWithCriteria.eventType,
            topics: eventWithCriteria.topics,
            audienceLevel: eventWithCriteria.audienceLevel,
          };
          criteria = eventWithCriteria.reviewCriteria.map((c) => ({
            name: c.name,
            description: c.description,
            weight: c.weight,
          }));
        }
      } catch {
        ctx.logger.warn('Failed to fetch event criteria, using defaults');
      }
    }

    // 2. Run duplicate detection if enabled
    // SECURITY: Limit submissions considered to prevent O(n²) resource exhaustion
    let similarSubmissions: SimilarSubmission[] = [];
    if (eventId && config.enableDuplicateDetection !== false) {
      try {
        const allSubmissions = await ctx.submissions.list({ eventId });
        const others = allSubmissions
          .filter((s) => s.id !== submissionId)
          .slice(0, PROCESSING_LIMITS.MAX_SUBMISSIONS_FOR_SIMILARITY);

        if (allSubmissions.length > PROCESSING_LIMITS.MAX_SUBMISSIONS_FOR_SIMILARITY + 1) {
          ctx.logger.info('Large event - duplicate detection limited to recent submissions', {
            totalSubmissions: allSubmissions.length,
            considered: PROCESSING_LIMITS.MAX_SUBMISSIONS_FOR_SIMILARITY,
          });
        }

        // Truncate abstracts to limit tokenization cost
        const truncatedOthers = others.map((s) => ({
          id: s.id,
          title: s.title,
          abstract: s.abstract?.slice(0, PROCESSING_LIMITS.MAX_ABSTRACT_LENGTH_FOR_SIMILARITY) || null,
        }));

        const truncatedAbstract = submissionData.abstract?.slice(
          0,
          PROCESSING_LIMITS.MAX_ABSTRACT_LENGTH_FOR_SIMILARITY
        ) || null;

        similarSubmissions = findSimilarSubmissions(
          submissionData.title,
          truncatedAbstract,
          truncatedOthers,
          config.duplicateThreshold ?? 0.7
        );
      } catch {
        ctx.logger.warn('Failed to run duplicate detection');
      }
    }

    // 3. Build dynamic prompt
    const similarInfo: SimilarSubmissionInfo[] = similarSubmissions.map((s) => ({
      title: s.title,
      similarity: s.similarity,
    }));

    const systemPrompt = buildSystemPrompt({
      event: eventContext,
      criteria,
      strictnessLevel: config.strictnessLevel || 'moderate',
      customPersona: config.customPersona,
      similarSubmissions: similarInfo,
      reviewFocus: config.reviewFocus,
    });

    // 4. Build submission text (using fetched data for re-reviews)
    const submissionText = buildSubmissionText({
      title: submissionData.title,
      abstract: submissionData.abstract,
      outline: submissionData.outline,
      targetAudience: submissionData.targetAudience,
      prerequisites: submissionData.prerequisites,
      speaker: submissionData.speaker,
      coSpeakers: submissionData.coSpeakers,
    });

    // 5. Call AI with temperature and parse with retry
    const { result, inputTruncated, usage, costUsd } = await callAiProvider(config, submissionText, systemPrompt);

    // 6. Attach similar submissions to result
    if (similarSubmissions.length > 0) {
      result.similarSubmissions = similarSubmissions;
    }

    // 7. Update cost tracking
    try {
      const now = new Date().toISOString();
      const existingStats = await ctx.data.get<CostStats>('costs', 'current-period');

      const updatedStats: CostStats = {
        totalSpend: (existingStats?.totalSpend ?? 0) + costUsd,
        totalInputTokens: (existingStats?.totalInputTokens ?? 0) + usage.inputTokens,
        totalOutputTokens: (existingStats?.totalOutputTokens ?? 0) + usage.outputTokens,
        reviewCount: (existingStats?.reviewCount ?? 0) + 1,
        periodStart: existingStats?.periodStart ?? now,
        lastUpdated: now,
      };

      await ctx.data.set('costs', 'current-period', updatedStats);

      ctx.logger.info('AI review completed', {
        submissionId,
        overallScore: result.overallScore,
        recommendation: result.recommendation,
        confidence: result.confidence,
        inputTruncated,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: costUsd.toFixed(4),
        totalSpend: updatedStats.totalSpend.toFixed(4),
      });
    } catch (costErr) {
      // Log but don't fail the review if cost tracking fails
      ctx.logger.warn('Failed to update cost tracking', {
        error: costErr instanceof Error ? costErr.message : String(costErr),
      });
      ctx.logger.info('AI review completed', {
        submissionId,
        overallScore: result.overallScore,
        recommendation: result.recommendation,
        confidence: result.confidence,
        inputTruncated,
      });
    }

    // Strip rawResponse before persisting to job results
    const { rawResponse: _raw, ...sanitizedAnalysis } = result;

    // 7. Create or update a review in the core reviews table
    let reviewId: string | undefined;
    try {
      // Get the service account ID
      const serviceAccountId = await ctx.data.get<string>('config', 'service-account-id');
      ctx.logger.info('Service account lookup', { serviceAccountId, submissionId });

      if (serviceAccountId) {
        // Check if there's an existing review from this service account for this submission
        const existingReviews = await ctx.reviews.list({ submissionId, reviewerId: serviceAccountId });
        const existingReview = existingReviews.length > 0 ? existingReviews[0] : null;
        ctx.logger.info('Existing review check', {
          foundReviews: existingReviews.length,
          existingReviewId: existingReview?.id || null,
          submissionId,
          reviewerId: serviceAccountId
        });

        // Map AI recommendation to ReviewRecommendation enum
        const recommendationMap: Record<string, 'STRONG_ACCEPT' | 'ACCEPT' | 'NEUTRAL' | 'REJECT' | 'STRONG_REJECT'> = {
          'STRONG_ACCEPT': 'STRONG_ACCEPT',
          'ACCEPT': 'ACCEPT',
          'NEUTRAL': 'NEUTRAL',
          'REJECT': 'REJECT',
          'STRONG_REJECT': 'STRONG_REJECT',
        };
        const mappedRecommendation = recommendationMap[result.recommendation.toUpperCase()] || 'NEUTRAL';

        // Build detailed private notes with AI analysis (only include sections with content)
        const privateNoteParts = [`## AI Analysis Summary`, result.summary || 'No summary available.', ''];

        if (result.strengths && result.strengths.length > 0) {
          privateNoteParts.push(`### Strengths`);
          privateNoteParts.push(...result.strengths.map((s) => `- ${s}`));
          privateNoteParts.push('');
        }

        if (result.weaknesses && result.weaknesses.length > 0) {
          privateNoteParts.push(`### Weaknesses`);
          privateNoteParts.push(...result.weaknesses.map((w) => `- ${w}`));
          privateNoteParts.push('');
        }

        if (result.suggestions && result.suggestions.length > 0) {
          privateNoteParts.push(`### Suggestions`);
          privateNoteParts.push(...result.suggestions.map((s) => `- ${s}`));
          privateNoteParts.push('');
        }

        privateNoteParts.push(`---`);
        privateNoteParts.push(`*Confidence: ${(result.confidence * 100).toFixed(0)}%*`);
        privateNoteParts.push(`*Model: ${config.model || 'gpt-4o'}*`);

        const privateNotes = privateNoteParts.join('\n');

        // Public notes left empty - admins decide what feedback to share with speakers
        const publicNotes = undefined;

        // Extract scores from criteriaScores if available
        const criteriaScores = result.criteriaScores || {};
        const contentScore = criteriaScores['Content Quality'] || criteriaScores['content'] || result.overallScore;
        const presentationScore = criteriaScores['Presentation Clarity'] || criteriaScores['presentation'] || result.overallScore;
        const relevanceScore = criteriaScores['Relevance'] || criteriaScores['relevance'] || result.overallScore;

        const reviewData = {
          overallScore: result.overallScore,
          contentScore,
          presentationScore,
          relevanceScore,
          privateNotes,
          publicNotes,
          recommendation: mappedRecommendation,
        };

        let review;
        if (existingReview) {
          // Update existing review (for re-reviews)
          review = await ctx.reviews.update(existingReview.id, reviewData);
          ctx.logger.info('Updated existing review in core reviews table', {
            reviewId: review.id,
            submissionId,
            overallScore: result.overallScore,
          });
        } else {
          // Try to create new review, but handle unique constraint errors
          try {
            review = await ctx.reviews.create({
              submissionId,
              reviewerId: serviceAccountId,
              ...reviewData,
            });
            ctx.logger.info('Created review in core reviews table', {
              reviewId: review.id,
              submissionId,
              overallScore: result.overallScore,
            });
          } catch (createError) {
            // If unique constraint error, find the review by submission and update it
            if (createError instanceof Error && createError.message.includes('Unique constraint')) {
              ctx.logger.info('Review already exists, finding and updating...', { submissionId });
              const allReviews = await ctx.reviews.getBySubmission(submissionId);
              // SECURITY: Only identify AI reviews by reviewerId - never by content pattern
              // Content-based detection (e.g., privateNotes prefix) can be spoofed by other reviewers
              const aiReview = allReviews.find(r => r.reviewerId === serviceAccountId);
              if (aiReview) {
                review = await ctx.reviews.update(aiReview.id, reviewData);
                ctx.logger.info('Updated review after unique constraint error', {
                  reviewId: review.id,
                  submissionId,
                  overallScore: result.overallScore,
                });
              } else {
                // No AI review found - this might be a constraint on something other than reviewerId
                // Log and re-throw to avoid corrupting other users' reviews
                ctx.logger.error('Unique constraint but no AI review found for this submission', {
                  submissionId,
                  serviceAccountId,
                  totalReviews: allReviews.length,
                });
                throw createError;
              }
            } else {
              throw createError;
            }
          }
        }

        reviewId = review.id;
      } else {
        ctx.logger.warn('No service account ID found, skipping core review creation');
      }
    } catch (error) {
      ctx.logger.error('Failed to create/update core review', {
        submissionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Get eventSlug from payload for linking
    const eventSlug = payload.eventSlug as string | undefined;

    return {
      success: true,
      data: {
        submissionId,
        eventSlug,
        reviewId,
        analysis: sanitizedAnalysis,
        analyzedAt: result.analyzedAt,
        provider: config.aiProvider || 'openai',
        model: config.model || 'gpt-4o',
        // Cost tracking data (v1.14.0+)
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
        costUsd,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error('AI review failed', { submissionId, error: message });
    return { success: false, error: message };
  }
}
