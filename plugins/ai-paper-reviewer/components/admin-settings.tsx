'use client';

/**
 * AI Paper Reviewer Settings Page
 *
 * Full configuration page with grouped sections. All settings are
 * stored in plugin data (ctx.data) via save-settings/get-settings actions.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Zap,
  Bot,
  Cpu,
  Info,
} from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

// =============================================================================
// Types
// =============================================================================

interface ModelOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

interface SettingsState {
  aiProvider: string;
  apiKey: string;
  enableWebSearch: boolean;
  model: string;
  strictnessLevel: string;
  useEventCriteria: boolean;
  autoReview: boolean;
  showAiReviewerOnTeamPage: boolean;
  budgetLimit: number;
  budgetAlertThreshold: number;
  pauseOnBudgetExceeded: boolean;
  enableDuplicateDetection: boolean;
  duplicateThreshold: number;
  temperature: number;
  confidenceThreshold: number;
  reReviewCooldownMinutes: number;
  maxTokens: number;
  maxInputChars: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  aiProvider: 'gemini',
  apiKey: '',
  enableWebSearch: true,
  model: 'gemini-2.0-flash',
  strictnessLevel: 'moderate',
  useEventCriteria: true,
  autoReview: true,
  showAiReviewerOnTeamPage: false,
  budgetLimit: 0,
  budgetAlertThreshold: 80,
  pauseOnBudgetExceeded: true,
  enableDuplicateDetection: true,
  duplicateThreshold: 0.7,
  temperature: 0.3,
  confidenceThreshold: 0.5,
  reReviewCooldownMinutes: 5,
  maxTokens: 4096,
  maxInputChars: 50000,
};

// =============================================================================
// Provider Cards
// =============================================================================

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Includes Google Search for fact-checking',
    badge: 'Recommended',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o and GPT-4o Mini models',
    icon: <Bot className="h-5 w-5" />,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet and Haiku models',
    icon: <Cpu className="h-5 w-5" />,
  },
];

// =============================================================================
// Collapsible Section
// =============================================================================

function Section({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Field Components
// =============================================================================

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            checked ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
            style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

function SliderField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  labels,
  formatValue,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  labels?: { start: string; end: string };
  formatValue?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate-900 dark:text-white">{label}</label>
        <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-600"
      />
      {labels && (
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>{labels.start}</span>
          <span>{labels.end}</span>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{hint}</p>}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          let v = parseFloat(e.target.value) || 0;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onChange(v);
        }}
        min={min}
        max={max}
        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{hint}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AdminSettings({ context }: PluginComponentProps) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    try {
      const response = await context.api.fetch('/actions/get-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success && data.config) {
        const cfg = data.config;
        const loaded: SettingsState = {
          aiProvider: cfg.aiProvider || DEFAULT_SETTINGS.aiProvider,
          apiKey: '', // Never pre-fill — shown as masked separately
          enableWebSearch: cfg.enableWebSearch ?? DEFAULT_SETTINGS.enableWebSearch,
          model: cfg.model || DEFAULT_SETTINGS.model,
          strictnessLevel: cfg.strictnessLevel || DEFAULT_SETTINGS.strictnessLevel,
          useEventCriteria: cfg.useEventCriteria ?? DEFAULT_SETTINGS.useEventCriteria,
          autoReview: cfg.autoReview ?? DEFAULT_SETTINGS.autoReview,
          showAiReviewerOnTeamPage: cfg.showAiReviewerOnTeamPage ?? DEFAULT_SETTINGS.showAiReviewerOnTeamPage,
          budgetLimit: cfg.budgetLimit ?? DEFAULT_SETTINGS.budgetLimit,
          budgetAlertThreshold: cfg.budgetAlertThreshold ?? DEFAULT_SETTINGS.budgetAlertThreshold,
          pauseOnBudgetExceeded: cfg.pauseOnBudgetExceeded ?? DEFAULT_SETTINGS.pauseOnBudgetExceeded,
          enableDuplicateDetection: cfg.enableDuplicateDetection ?? DEFAULT_SETTINGS.enableDuplicateDetection,
          duplicateThreshold: cfg.duplicateThreshold ?? DEFAULT_SETTINGS.duplicateThreshold,
          temperature: cfg.temperature ?? DEFAULT_SETTINGS.temperature,
          confidenceThreshold: cfg.confidenceThreshold ?? DEFAULT_SETTINGS.confidenceThreshold,
          reReviewCooldownMinutes: cfg.reReviewCooldownMinutes ?? DEFAULT_SETTINGS.reReviewCooldownMinutes,
          maxTokens: cfg.maxTokens ?? DEFAULT_SETTINGS.maxTokens,
          maxInputChars: cfg.maxInputChars ?? DEFAULT_SETTINGS.maxInputChars,
        };
        setSettings(loaded);
        setOriginalSettings(loaded);
        setHasExistingKey(cfg._hasApiKey === true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [context.api]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load models when provider or API key changes
  const fetchModels = useCallback(async (provider: string, apiKey?: string) => {
    setLoadingModels(true);
    try {
      const params: Record<string, string> = { provider };
      if (apiKey) params.apiKey = apiKey;

      const response = await context.api.fetch('/actions/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      if (data.success && data.models) {
        setModels(
          data.models.map((m: { id: string; name: string; description?: string; recommended?: boolean }) => ({
            value: m.id,
            label: m.name,
            description: m.description,
            recommended: m.recommended,
          }))
        );
      }
    } catch {
      // Silently fail — user can still type model name
    } finally {
      setLoadingModels(false);
    }
  }, [context.api]);

  // Load models on initial load if we have a key
  useEffect(() => {
    if (!loading && hasExistingKey) {
      fetchModels(settings.aiProvider);
    }
  }, [loading, hasExistingKey]); // Only trigger on initial load, not on fetchModels changes

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  const handleProviderChange = (providerId: string) => {
    update('aiProvider', providerId);
    // Reset model to default for new provider
    const defaultModels: Record<string, string> = {
      gemini: 'gemini-2.0-flash',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-20250514',
    };
    update('model', defaultModels[providerId] || '');
    setModels([]);
    // Fetch models for new provider if we have a key
    if (hasExistingKey || settings.apiKey) {
      fetchModels(providerId, settings.apiKey || undefined);
    }
  };

  const handleApiKeyValidate = () => {
    if (settings.apiKey) {
      fetchModels(settings.aiProvider, settings.apiKey);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setError(null);

    try {
      // Build payload — only include apiKey if user entered a new one
      const payload: Record<string, unknown> = {
        aiProvider: settings.aiProvider,
        enableWebSearch: settings.enableWebSearch,
        model: settings.model,
        strictnessLevel: settings.strictnessLevel,
        useEventCriteria: settings.useEventCriteria,
        autoReview: settings.autoReview,
        showAiReviewerOnTeamPage: settings.showAiReviewerOnTeamPage,
        budgetLimit: settings.budgetLimit,
        budgetAlertThreshold: settings.budgetAlertThreshold,
        pauseOnBudgetExceeded: settings.pauseOnBudgetExceeded,
        enableDuplicateDetection: settings.enableDuplicateDetection,
        duplicateThreshold: settings.duplicateThreshold,
        temperature: settings.temperature,
        confidenceThreshold: settings.confidenceThreshold,
        reReviewCooldownMinutes: settings.reReviewCooldownMinutes,
        maxTokens: settings.maxTokens,
        maxInputChars: settings.maxInputChars,
      };

      if (settings.apiKey) {
        payload.apiKey = settings.apiKey;
      }

      const response = await context.api.fetch('/actions/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaveStatus('success');
      setOriginalSettings({ ...settings, apiKey: '' });
      if (settings.apiKey) {
        setHasExistingKey(true);
        setSettings((prev) => ({ ...prev, apiKey: '' }));
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify({ ...settings, apiKey: '' }) !== JSON.stringify({ ...originalSettings, apiKey: '' }) ||
    settings.apiKey.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasChanges
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
          data-testid="save-button"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Provider Section */}
      <Section title="AI Provider" description="Connect to your AI service">
        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`relative p-3 text-left rounded-lg border-2 transition-all ${
                settings.aiProvider === p.id
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
              }`}
            >
              {settings.aiProvider === p.id && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`p-1.5 rounded ${
                    settings.aiProvider === p.id
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {p.icon}
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
              {p.badge && (
                <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                  {p.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
            API Key
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {hasExistingKey
              ? 'API key is configured. Enter a new key to replace it.'
              : 'Enter your API key from the provider dashboard.'}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
                placeholder={hasExistingKey ? 'Enter new key to replace existing...' : 'Enter your API key'}
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="api-key-input"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {settings.apiKey && (
              <button
                type="button"
                onClick={handleApiKeyValidate}
                disabled={loadingModels}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
              >
                {loadingModels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Validate
              </button>
            )}
          </div>
          {hasExistingKey && !settings.apiKey && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              API key is configured and encrypted
            </p>
          )}
        </div>

        {/* Web Search toggle (Gemini only) */}
        {settings.aiProvider === 'gemini' && (
          <Toggle
            label="Enable Web Search (Grounding)"
            hint="Allow AI to search the web for fact-checking recent events and claims using Google Search."
            checked={settings.enableWebSearch}
            onChange={(v) => update('enableWebSearch', v)}
          />
        )}

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Model</label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            AI model for generating reviews. Available models load from your provider.
          </p>
          {loadingModels ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading models...
            </div>
          ) : models.length > 0 ? (
            <select
              value={settings.model}
              onChange={(e) => update('model', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="e.g., gemini-2.0-flash"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          )}
        </div>
      </Section>

      {/* Review Style */}
      <Section title="Review Style" description="Customize how reviews are generated">
        <SelectField
          label="Review Strictness"
          hint="Lenient: Encouraging and supportive. Moderate: Balanced. Strict: High standards."
          value={settings.strictnessLevel}
          onChange={(v) => update('strictnessLevel', v)}
          options={[
            { value: 'lenient', label: 'Lenient' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'strict', label: 'Strict' },
          ]}
        />
        <Toggle
          label="Use Event's Review Criteria"
          hint="Match reviews to your event's specific scoring criteria. Highly recommended."
          checked={settings.useEventCriteria}
          onChange={(v) => update('useEventCriteria', v)}
        />
      </Section>

      {/* Automation */}
      <Section title="Automation" description="Control when reviews happen">
        <Toggle
          label="Auto-Review New Submissions"
          hint="Automatically review submissions when they come in. Disable to trigger reviews manually."
          checked={settings.autoReview}
          onChange={(v) => update('autoReview', v)}
        />
        <Toggle
          label="Show AI Reviewer Publicly"
          hint="List the AI reviewer on your public team page."
          checked={settings.showAiReviewerOnTeamPage}
          onChange={(v) => update('showAiReviewerOnTeamPage', v)}
        />
      </Section>

      {/* Budget */}
      <Section title="Cost & Budget" description="Track spending and set budget limits">
        <NumberField
          label="Monthly Budget Limit (USD)"
          hint="Maximum monthly spend on AI reviews. Set to 0 for unlimited."
          value={settings.budgetLimit}
          onChange={(v) => update('budgetLimit', v)}
          min={0}
        />
        <SliderField
          label="Budget Alert Threshold"
          hint="Show warning when spending reaches this percentage of budget."
          value={settings.budgetAlertThreshold}
          onChange={(v) => update('budgetAlertThreshold', v)}
          min={50}
          max={100}
          step={5}
          labels={{ start: '50%', end: '100%' }}
          formatValue={(v) => `${v}%`}
        />
        <Toggle
          label="Pause Reviews When Budget Exceeded"
          hint="Stop auto-reviews when budget limit is reached."
          checked={settings.pauseOnBudgetExceeded}
          onChange={(v) => update('pauseOnBudgetExceeded', v)}
        />
      </Section>

      {/* Quality Checks */}
      <Section title="Quality Checks" description="Optional duplicate detection" defaultOpen={false}>
        <Toggle
          label="Detect Similar Submissions"
          hint="Flag potential duplicate or overlapping submissions."
          checked={settings.enableDuplicateDetection}
          onChange={(v) => update('enableDuplicateDetection', v)}
        />
        {settings.enableDuplicateDetection && (
          <SliderField
            label="Similarity Threshold"
            hint="Lower = more flags (may include false positives). Higher = only very similar."
            value={settings.duplicateThreshold}
            onChange={(v) => update('duplicateThreshold', v)}
            min={0.5}
            max={0.95}
            step={0.05}
            labels={{ start: 'Catch more', end: 'Only obvious' }}
            formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          />
        )}
      </Section>

      {/* Advanced */}
      <Section title="Advanced Settings" description="Fine-tune technical parameters" defaultOpen={false}>
        <SliderField
          label="Response Variability (Temperature)"
          hint="Default (0.3) produces reliable, consistent reviews. Increase for more varied feedback."
          value={settings.temperature}
          onChange={(v) => update('temperature', v)}
          min={0}
          max={1}
          step={0.1}
          labels={{ start: 'Consistent', end: 'Creative' }}
        />
        <SliderField
          label="Confidence Threshold"
          hint="Flag reviews when AI confidence is below this level."
          value={settings.confidenceThreshold}
          onChange={(v) => update('confidenceThreshold', v)}
          min={0}
          max={1}
          step={0.1}
          labels={{ start: 'Show all', end: 'High only' }}
        />
        <NumberField
          label="Re-review Cooldown (minutes)"
          hint="Wait time before auto-reviewing an edited submission."
          value={settings.reReviewCooldownMinutes}
          onChange={(v) => update('reReviewCooldownMinutes', v)}
          min={1}
          max={60}
        />
        <NumberField
          label="Maximum Response Tokens"
          hint="Maximum tokens for AI response (100-16384). Default is sufficient for most reviews."
          value={settings.maxTokens}
          onChange={(v) => update('maxTokens', v)}
          min={100}
          max={16384}
        />
        <NumberField
          label="Maximum Input Characters"
          hint="Maximum submission text size sent to AI (1000-100000)."
          value={settings.maxInputChars}
          onChange={(v) => update('maxInputChars', v)}
          min={1000}
          max={100000}
        />
      </Section>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Settings Storage
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              All settings are stored securely within the plugin. Your API key is encrypted at rest.
              Changes take effect immediately for new reviews. Existing queued reviews will use the
              settings that were active when they were queued.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Save Button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
