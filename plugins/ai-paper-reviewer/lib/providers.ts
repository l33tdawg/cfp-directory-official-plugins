/**
 * AI Paper Reviewer - Provider Module
 *
 * Abstraction over OpenAI, Anthropic, and Gemini API calls.
 */

export interface ProviderOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  userContent: string;
}

/**
 * Token usage from AI provider response
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Response from AI provider including content and usage
 */
export interface ProviderResponse {
  content: string;
  usage: TokenUsage;
}

/**
 * Call OpenAI Chat Completions API
 */
export async function callOpenAI(opts: ProviderOptions): Promise<ProviderResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    content,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

/**
 * Call Anthropic Messages API
 */
export async function callAnthropic(opts: ProviderOptions): Promise<ProviderResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userContent }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  return {
    content,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

/**
 * Call Google Gemini API
 * Security: Uses x-goog-api-key header instead of query parameter to prevent
 * API key exposure in logs, proxy caches, and browser history.
 */
export async function callGemini(opts: ProviderOptions): Promise<ProviderResponse> {
  // Security: API key in header, not URL query string
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${opts.systemPrompt}\n\n${opts.userContent}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: opts.maxTokens,
        temperature: opts.temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return {
    content,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

/**
 * Dispatcher - call the appropriate provider
 */
export async function callProvider(
  provider: string,
  opts: ProviderOptions
): Promise<ProviderResponse> {
  switch (provider) {
    case 'openai':
      return callOpenAI(opts);
    case 'anthropic':
      return callAnthropic(opts);
    case 'gemini':
      return callGemini(opts);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
