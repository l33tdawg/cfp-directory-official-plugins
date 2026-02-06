'use client';

/**
 * AI Paper Reviewer Onboarding Wizard
 *
 * Multi-step wizard for first-time setup:
 * 1. Choose AI provider
 * 2. Enter API key (with validation)
 * 3. Choose model (fetched from provider)
 * 4. Set up reviewer persona
 * 5. Finish and start reviewing
 */

import React, { useState, useCallback } from 'react';
import {
  Bot,
  Key,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Zap,
  BookOpen,
  Lightbulb,
  Scale,
  Check,
} from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

// =============================================================================
// Types
// =============================================================================

type Provider = 'openai' | 'anthropic' | 'gemini';

interface ModelOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

interface PersonaPreset {
  id: string;
  name: string;
  description: string;
  persona: string;
  icon: React.ReactNode;
}

// =============================================================================
// Constants
// =============================================================================

const PROVIDERS: { id: Provider; name: string; description: string; badge?: string; icon: React.ReactNode }[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Includes Google Search for fact-checking recent events and claims',
    badge: 'Recommended',
    icon: <Zap className="h-6 w-6" />,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o and GPT-4o Mini models',
    icon: <Bot className="h-6 w-6" />,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet and Haiku models',
    icon: <Cpu className="h-6 w-6" />,
  },
];

const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'technical',
    name: 'Technical Expert',
    description: 'Focuses on technical accuracy and rigor',
    persona:
      'You are a senior technical reviewer with deep expertise. Focus on technical accuracy, code quality, architectural decisions, and implementation feasibility. Be rigorous but constructive.',
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    id: 'educator',
    name: 'Educator',
    description: 'Emphasizes clarity and learning value',
    persona:
      'You are an experienced educator and conference speaker. Focus on how well the content will be understood by the target audience. Evaluate clarity, logical flow, and educational value.',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: 'innovation',
    name: 'Innovation Scout',
    description: 'Prioritizes novelty and fresh perspectives',
    persona:
      'You are an innovation-focused reviewer looking for fresh ideas and novel approaches. Prioritize submissions that bring new perspectives or introduce emerging technologies.',
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    id: 'balanced',
    name: 'Balanced Reviewer',
    description: 'Well-rounded review covering all aspects',
    persona:
      'You are a balanced reviewer who evaluates all aspects equally. Consider technical merit, presentation quality, originality, and relevance. Provide constructive feedback.',
    icon: <Scale className="h-5 w-5" />,
  },
];

// =============================================================================
// Step Components
// =============================================================================

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i < currentStep
              ? 'w-8 bg-purple-600'
              : i === currentStep
                ? 'w-8 bg-purple-400'
                : 'w-2 bg-slate-300 dark:bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
}

function ProviderStep({
  selected,
  onSelect,
}: {
  selected: Provider | null;
  onSelect: (provider: Provider) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Choose Your AI Provider
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Select the AI service you want to use for reviewing submissions
        </p>
      </div>

      <div className="grid gap-4">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={`relative p-4 text-left rounded-lg border-2 transition-all ${
              selected === provider.id
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
            }`}
          >
            {selected === provider.id && (
              <div className="absolute top-3 right-3">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
            )}
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${
                  selected === provider.id
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {provider.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{provider.name}</h3>
                  {provider.badge && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                      {provider.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{provider.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ApiKeyStep({
  provider,
  apiKey,
  onApiKeyChange,
  onValidate,
  validating,
  validated,
  error,
}: {
  provider: Provider;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onValidate: () => void;
  validating: boolean;
  validated: boolean;
  error: string | null;
}) {
  const providerName = PROVIDERS.find((p) => p.id === provider)?.name || provider;

  const getApiKeyHelp = () => {
    switch (provider) {
      case 'openai':
        return 'Get your API key from platform.openai.com/api-keys';
      case 'anthropic':
        return 'Get your API key from console.anthropic.com/settings/keys';
      case 'gemini':
        return 'Get your API key from aistudio.google.com/apikey';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Enter Your {providerName} API Key
        </h2>
        <p className="text-slate-600 dark:text-slate-400">{getApiKeyHelp()}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={provider === 'openai' ? 'sk-...' : 'Enter your API key'}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              data-testid="api-key-input"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {validated && !error && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">API key validated successfully!</p>
            </div>
          </div>
        )}

        <button
          onClick={onValidate}
          disabled={!apiKey || validating || validated}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="validate-key-button"
        >
          {validating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : validated ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Validated
            </>
          ) : (
            <>
              <Key className="h-4 w-4" />
              Validate API Key
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ModelStep({
  models,
  selectedModel,
  onSelect,
  loading,
}: {
  models: ModelOption[];
  selectedModel: string | null;
  onSelect: (model: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Choose a Model</h2>
          <p className="text-slate-600 dark:text-slate-400">Loading available models...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Choose a Model</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Select the AI model for generating reviews
        </p>
      </div>

      <div className="grid gap-3 max-h-[400px] overflow-y-auto">
        {models.map((model) => (
          <button
            key={model.value}
            onClick={() => onSelect(model.value)}
            className={`p-4 text-left rounded-lg border-2 transition-all ${
              selectedModel === model.value
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Selection indicator */}
              <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedModel === model.value
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {selectedModel === model.value && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>

              {/* Model info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{model.label}</h3>
                </div>
                {model.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {model.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonaStep({
  selectedPreset,
  customPersona,
  onSelectPreset,
  onCustomPersonaChange,
}: {
  selectedPreset: string | null;
  customPersona: string;
  onSelectPreset: (preset: string) => void;
  onCustomPersonaChange: (persona: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Set Up Reviewer Persona
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Choose how the AI reviewer should approach submissions
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PERSONA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              onSelectPreset(preset.id);
              onCustomPersonaChange(preset.persona);
            }}
            className={`relative p-4 text-left rounded-lg border-2 transition-all ${
              selectedPreset === preset.id
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
            }`}
          >
            {selectedPreset === preset.id && (
              <div className="absolute top-2 right-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
              </div>
            )}
            <div
              className={`p-2 rounded-lg inline-block mb-2 ${
                selectedPreset === preset.id
                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {preset.icon}
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{preset.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{preset.description}</p>
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Or customize the persona instructions
        </label>
        <textarea
          value={customPersona}
          onChange={(e) => {
            onCustomPersonaChange(e.target.value);
            onSelectPreset('custom');
          }}
          placeholder="Enter custom instructions for how the AI should review submissions..."
          className="w-full h-24 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          data-testid="custom-persona-input"
        />
      </div>
    </div>
  );
}

function FinishStep({
  provider,
  model,
  persona,
  saving,
}: {
  provider: Provider;
  model: string;
  persona: string;
  saving: boolean;
}) {
  const providerName = PROVIDERS.find((p) => p.id === provider)?.name || provider;
  const presetName = PERSONA_PRESETS.find((p) => p.persona === persona)?.name || 'Custom';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Ready to Start Reviewing!
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your AI Paper Reviewer is configured and ready to analyze submissions
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Provider</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{providerName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Model</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{model}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Persona</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{presetName}</span>
        </div>
      </div>

      {saving && (
        <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Saving configuration...</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AdminOnboarding({ context, onComplete }: PluginComponentProps & { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyValidated, setKeyValidated] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>('balanced');
  const [customPersona, setCustomPersona] = useState(PERSONA_PRESETS.find((p) => p.id === 'balanced')?.persona || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 5;

  // Validate API key by fetching models
  const validateApiKey = useCallback(async () => {
    if (!provider || !apiKey) return;

    setValidatingKey(true);
    setKeyError(null);

    try {
      const response = await context.api.fetch('/actions/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to validate API key');
      }

      // Store models for next step
      // Note: API already includes "(Recommended)" in name for recommended models
      const modelList: ModelOption[] = data.models.map((m: { id: string; name: string; description?: string; recommended?: boolean }) => ({
        value: m.id,
        label: m.name,
        description: m.description,
        recommended: m.recommended || m.name.toLowerCase().includes('recommended'),
      }));
      setModels(modelList);
      setKeyValidated(true);

      // Auto-select the first recommended model (they're sorted with recommended first)
      const recommended = modelList.find((m) => m.recommended);
      if (recommended) {
        setSelectedModel(recommended.value);
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to validate API key');
    } finally {
      setValidatingKey(false);
    }
  }, [provider, apiKey, context.api]);

  // Save configuration via plugin's save-settings action
  const saveConfiguration = useCallback(async () => {
    if (!provider || !apiKey || !selectedModel) return;

    setSaving(true);
    setError(null);

    try {
      const response = await context.api.fetch('/actions/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider: provider,
          apiKey: apiKey,
          model: selectedModel,
          customPersona: customPersona,
          autoReview: true,
          useEventCriteria: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      // Notify parent that onboarding is complete
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [provider, apiKey, selectedModel, customPersona, context.api, onComplete]);

  const canProceed = () => {
    switch (step) {
      case 0:
        return provider !== null;
      case 1:
        return keyValidated;
      case 2:
        return selectedModel !== null;
      case 3:
        return customPersona.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step === totalSteps - 1) {
      await saveConfiguration();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      // Reset validation state when going back from API key step
      setKeyValidated(false);
      setKeyError(null);
      setModels([]);
      setSelectedModel(null);
    }
    setStep((s) => s - 1);
  };

  return (
    <div className="max-w-lg mx-auto py-8" data-testid="admin-onboarding">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          AI Paper Reviewer Setup
        </h1>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} totalSteps={totalSteps} />

      {/* Step content */}
      <div className="mb-8">
        {step === 0 && <ProviderStep selected={provider} onSelect={setProvider} />}
        {step === 1 && provider && (
          <ApiKeyStep
            provider={provider}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onValidate={validateApiKey}
            validating={validatingKey}
            validated={keyValidated}
            error={keyError}
          />
        )}
        {step === 2 && provider && (
          <ModelStep
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            loading={false}
          />
        )}
        {step === 3 && (
          <PersonaStep
            selectedPreset={selectedPreset}
            customPersona={customPersona}
            onSelectPreset={setSelectedPreset}
            onCustomPersonaChange={setCustomPersona}
          />
        )}
        {step === 4 && provider && selectedModel && (
          <FinishStep
            provider={provider}
            model={selectedModel}
            persona={customPersona}
            saving={saving}
          />
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-0 disabled:cursor-default transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!canProceed() || saving}
          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="next-button"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : step === totalSteps - 1 ? (
            <>
              <Check className="h-4 w-4" />
              Finish Setup
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
