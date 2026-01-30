/**
 * AI Paper Reviewer - Model Fetcher
 *
 * Fetches available models from AI providers (OpenAI, Anthropic, Gemini)
 * and validates API keys in the process.
 */

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface FetchModelsResult {
  success: boolean;
  models?: ModelOption[];
  error?: {
    code: 'INVALID_API_KEY' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'PROVIDER_ERROR' | 'NO_API_KEY';
    message: string;
  };
}

// =============================================================================
// OpenAI
// =============================================================================

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
}

const OPENAI_CHAT_MODEL_PREFIXES = ['gpt-4', 'gpt-3.5', 'o1', 'o3'];
const OPENAI_EXCLUDED_PATTERNS = [
  'embed',
  'whisper',
  'tts',
  'dall-e',
  'davinci',
  'babbage',
  'ada',
  'instruct',
  'search',
  'similarity',
  'code-',
  'text-',
  'audio',
  'realtime',
];

const OPENAI_RECOMMENDED_MODELS = ['gpt-4o', 'gpt-4o-mini'];

function formatOpenAIModelLabel(modelId: string): string {
  // GPT-4o -> GPT-4o, gpt-4o-mini -> GPT-4o Mini
  return modelId
    .split('-')
    .map((part, i) => {
      if (part === 'gpt') return 'GPT';
      if (part === 'o1' || part === 'o3') return part.toUpperCase();
      if (i === 0) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('-')
    .replace(/-Mini/g, ' Mini')
    .replace(/-Preview/g, ' Preview')
    .replace(/-Turbo/g, ' Turbo');
}

export async function fetchOpenAIModels(apiKey: string): Promise<FetchModelsResult> {
  if (!apiKey) {
    return {
      success: false,
      error: { code: 'NO_API_KEY', message: 'No API key provided' },
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401) {
      return {
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid OpenAI API key' },
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Rate limited by OpenAI. Try again in a moment.' },
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: `OpenAI API error (${response.status}): ${errorText}`,
        },
      };
    }

    const data: OpenAIModelsResponse = await response.json();

    const filteredModels = data.data
      .filter(
        (m) =>
          OPENAI_CHAT_MODEL_PREFIXES.some((p) => m.id.startsWith(p)) &&
          !OPENAI_EXCLUDED_PATTERNS.some((p) => m.id.includes(p))
      )
      .sort((a, b) => b.created - a.created) // Newest first
      .map((m) => ({
        value: m.id,
        label: formatOpenAIModelLabel(m.id),
        description: `Created ${new Date(m.created * 1000).toLocaleDateString()}`,
        recommended: OPENAI_RECOMMENDED_MODELS.includes(m.id),
      }));

    // Sort recommended models first
    filteredModels.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return 0;
    });

    // Add "(Recommended)" to label for recommended models
    const models = filteredModels.map((m) => ({
      ...m,
      label: m.recommended ? `${m.label} (Recommended)` : m.label,
    }));

    return { success: true, models };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Unable to connect to OpenAI: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

// =============================================================================
// Anthropic
// =============================================================================

interface AnthropicModel {
  id: string;
  created_at: string;
  display_name: string;
  type: string;
}

interface AnthropicModelsResponse {
  data: AnthropicModel[];
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}

const ANTHROPIC_RECOMMENDED_MODELS = ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'];

export async function fetchAnthropicModels(apiKey: string): Promise<FetchModelsResult> {
  if (!apiKey) {
    return {
      success: false,
      error: { code: 'NO_API_KEY', message: 'No API key provided' },
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (response.status === 401) {
      return {
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid Anthropic API key' },
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Rate limited by Anthropic. Try again in a moment.' },
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: `Anthropic API error (${response.status}): ${errorText}`,
        },
      };
    }

    const data: AnthropicModelsResponse = await response.json();

    const models = data.data.map((m) => {
      const isRecommended = ANTHROPIC_RECOMMENDED_MODELS.includes(m.id);
      return {
        value: m.id,
        label: isRecommended ? `${m.display_name} (Recommended)` : m.display_name,
        description: `Released ${new Date(m.created_at).toLocaleDateString()}`,
        recommended: isRecommended,
      };
    });

    // Sort recommended models first
    models.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return 0;
    });

    return { success: true, models };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Unable to connect to Anthropic: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

// =============================================================================
// Gemini
// =============================================================================

interface GeminiModel {
  name: string;
  baseModelId?: string;
  version?: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models: GeminiModel[];
  nextPageToken?: string;
}

const GEMINI_RECOMMENDED_MODELS = ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'];

export async function fetchGeminiModels(apiKey: string): Promise<FetchModelsResult> {
  if (!apiKey) {
    return {
      success: false,
      error: { code: 'NO_API_KEY', message: 'No API key provided' },
    };
  }

  try {
    // Security: API key in header, not URL query string (prevents log/proxy exposure)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
      }
    );

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || 'Invalid Gemini API key';
      return {
        success: false,
        error: { code: 'INVALID_API_KEY', message: errorMessage },
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Rate limited by Google. Try again in a moment.' },
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: `Gemini API error (${response.status}): ${errorText}`,
        },
      };
    }

    const data: GeminiModelsResponse = await response.json();

    const filteredModels = data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => {
        const modelId = m.baseModelId || m.name.replace('models/', '');
        const isRecommended = GEMINI_RECOMMENDED_MODELS.some((r) => modelId.includes(r));
        return {
          value: modelId,
          label: isRecommended ? `${m.displayName} (Recommended)` : m.displayName,
          description:
            m.description ||
            `${m.inputTokenLimit?.toLocaleString() || '?'} input / ${m.outputTokenLimit?.toLocaleString() || '?'} output tokens`,
          recommended: isRecommended,
        };
      });

    // Remove duplicates (some models appear multiple times with different versions)
    const uniqueModels = filteredModels.filter(
      (m, i, arr) => arr.findIndex((x) => x.value === m.value) === i
    );

    // Sort recommended models first
    uniqueModels.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return 0;
    });

    return { success: true, models: uniqueModels };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Unable to connect to Google: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

// =============================================================================
// Dispatcher
// =============================================================================

export async function fetchModelsForProvider(
  provider: string,
  apiKey: string
): Promise<FetchModelsResult> {
  switch (provider) {
    case 'openai':
      return fetchOpenAIModels(apiKey);
    case 'anthropic':
      return fetchAnthropicModels(apiKey);
    case 'gemini':
      return fetchGeminiModels(apiKey);
    default:
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: `Unsupported provider: ${provider}` },
      };
  }
}
