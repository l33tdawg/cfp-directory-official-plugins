/**
 * Plugin Configuration Module
 *
 * Centralizes config access for the AI Paper Reviewer plugin.
 * Config is stored in plugin data (ctx.data) instead of platform config,
 * giving the plugin full ownership of its settings.
 */

import type { PluginContext } from '@/lib/plugins';

// =============================================================================
// CONFIG INTERFACE
// =============================================================================

export interface AiReviewerConfig {
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
  /** Enable web search/grounding for fact-checking (Gemini only) */
  enableWebSearch?: boolean;
}

// =============================================================================
// GENERAL SETTINGS (non-sensitive, stored as one JSON object)
// =============================================================================

interface GeneralSettings {
  aiProvider?: 'openai' | 'anthropic' | 'gemini';
  model?: string;
  temperature?: number;
  autoReview?: boolean;
  useEventCriteria?: boolean;
  strictnessLevel?: 'lenient' | 'moderate' | 'strict';
  customPersona?: string;
  reviewFocus?: string[];
  enableDuplicateDetection?: boolean;
  duplicateThreshold?: number;
  confidenceThreshold?: number;
  showAiReviewerOnTeamPage?: boolean;
  reReviewCooldownMinutes?: number;
  maxTokens?: number;
  maxInputChars?: number;
  budgetLimit?: number;
  budgetAlertThreshold?: number;
  pauseOnBudgetExceeded?: boolean;
  enableWebSearch?: boolean;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const CONFIG_DEFAULTS: Required<Omit<AiReviewerConfig, 'apiKey' | 'customPersona' | 'reviewFocus'>> = {
  aiProvider: 'gemini',
  model: 'gemini-2.0-flash',
  temperature: 0.3,
  autoReview: true,
  useEventCriteria: true,
  strictnessLevel: 'moderate',
  enableDuplicateDetection: true,
  duplicateThreshold: 0.7,
  confidenceThreshold: 0.5,
  showAiReviewerOnTeamPage: false,
  reReviewCooldownMinutes: 5,
  maxTokens: 4096,
  maxInputChars: 50000,
  budgetLimit: 0,
  budgetAlertThreshold: 80,
  pauseOnBudgetExceeded: true,
  enableWebSearch: true,
};

// =============================================================================
// getConfig — Read config from ctx.data with defaults
// =============================================================================

/**
 * Reads plugin config from ctx.data (hybrid storage).
 * - API key: stored encrypted separately in `settings/apiKey`
 * - All other settings: stored as one JSON object in `settings/general`
 * - Returns fully-typed config with defaults applied
 */
export async function getConfig(ctx: PluginContext): Promise<AiReviewerConfig> {
  const [apiKey, general] = await Promise.all([
    ctx.data.get<string>('settings', 'apiKey'),
    ctx.data.get<GeneralSettings>('settings', 'general'),
  ]);

  return {
    ...CONFIG_DEFAULTS,
    ...general,
    apiKey: apiKey ?? undefined,
    customPersona: general?.customPersona,
    reviewFocus: general?.reviewFocus,
  };
}

// =============================================================================
// migrateFromPlatformConfig — One-time migration from ctx.config
// =============================================================================

/**
 * Migrates config from platform-managed ctx.config to plugin-owned ctx.data.
 * Only runs once — sets a `_migrated` flag to prevent re-running.
 * Provides seamless transition for existing deployments.
 */
export async function migrateFromPlatformConfig(ctx: PluginContext): Promise<boolean> {
  // Check if already migrated
  const migrated = await ctx.data.get<boolean>('settings', '_migrated');
  if (migrated) {
    return false;
  }

  // Check if there's anything to migrate from platform config
  const platformConfig = ctx.config as Record<string, unknown> | undefined;
  if (!platformConfig || Object.keys(platformConfig).length === 0) {
    // No platform config to migrate — mark as migrated so fresh installs
    // don't re-check on every enable
    await ctx.data.set('settings', '_migrated', true);
    return false;
  }

  ctx.logger.info('Migrating plugin config from platform to plugin data store');

  // Extract API key (store encrypted separately)
  const apiKey = platformConfig.apiKey as string | undefined;
  if (apiKey) {
    await ctx.data.set('settings', 'apiKey', apiKey, { encrypted: true });
  }

  // Extract all other settings into general object
  const general: GeneralSettings = {};
  const generalKeys: (keyof GeneralSettings)[] = [
    'aiProvider', 'model', 'temperature', 'autoReview', 'useEventCriteria',
    'strictnessLevel', 'customPersona', 'reviewFocus', 'enableDuplicateDetection',
    'duplicateThreshold', 'confidenceThreshold', 'showAiReviewerOnTeamPage',
    'reReviewCooldownMinutes', 'maxTokens', 'maxInputChars', 'budgetLimit',
    'budgetAlertThreshold', 'pauseOnBudgetExceeded', 'enableWebSearch',
  ];

  for (const key of generalKeys) {
    if (platformConfig[key] !== undefined) {
      (general as Record<string, unknown>)[key] = platformConfig[key];
    }
  }

  if (Object.keys(general).length > 0) {
    await ctx.data.set('settings', 'general', general);
  }

  // Mark migration complete
  await ctx.data.set('settings', '_migrated', true);

  ctx.logger.info('Config migration complete', {
    hasApiKey: !!apiKey,
    settingsCount: Object.keys(general).length,
  });

  return true;
}
