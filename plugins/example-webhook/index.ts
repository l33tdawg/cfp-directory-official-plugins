/**
 * Example: Webhook Notifications Plugin
 *
 * STARTER TEMPLATE FOR PLUGIN DEVELOPERS
 *
 * This is a reference implementation that demonstrates key plugin patterns:
 * - Typed hooks to react to submission and review events
 * - Configuration schema with validation (string, boolean, array, password fields)
 * - HTTP webhook payloads with HMAC-SHA256 signatures
 * - Background job queue for retry logic on failures
 *
 * Use this as a base for building your own plugins. Copy this directory,
 * rename it, and modify to fit your use case.
 */

import type { Plugin, PluginContext, PluginManifest } from '@/lib/plugins';
import manifestJson from './manifest.json';

const manifest: PluginManifest = manifestJson as PluginManifest;

// =============================================================================
// CONFIGURATION
// =============================================================================

interface WebhookConfig {
  webhookUrl?: string;
  secret?: string;
  events?: string[];
  retryOnFailure?: boolean;
  /** Include speaker PII (email, name) in webhook payloads - default false for privacy */
  includeSpeakerPii?: boolean;
  /** Allow HTTP URLs (not recommended - use only in development) */
  allowInsecureHttp?: boolean;
}

// =============================================================================
// URL SECURITY VALIDATION
// =============================================================================

/**
 * SSRF Protection: Validate that a webhook URL is safe to call.
 * Blocks private IPs, localhost, link-local, and optionally requires HTTPS.
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const ipv4PrivateRanges = [
    /^127\./, // Loopback
    /^10\./, // Class A private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
    /^192\.168\./, // Class C private
    /^169\.254\./, // Link-local
    /^0\./, // Current network
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  ];

  // IPv6 private/local patterns
  const ipv6PrivatePatterns = [
    /^::1$/, // Loopback
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local
    /^fd[0-9a-f]{2}:/i, // Unique local
    /^::ffff:127\./i, // IPv4-mapped loopback
    /^::ffff:10\./i, // IPv4-mapped private
    /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i, // IPv4-mapped private
    /^::ffff:192\.168\./i, // IPv4-mapped private
    /^::ffff:169\.254\./i, // IPv4-mapped link-local
  ];

  for (const pattern of ipv4PrivateRanges) {
    if (pattern.test(ip)) return true;
  }

  for (const pattern of ipv6PrivatePatterns) {
    if (pattern.test(ip)) return true;
  }

  return false;
}

/**
 * Resolve hostname to IP addresses with timeout protection
 * Returns null if DNS resolution is not available (browser/edge runtime)
 */
async function resolveHostname(hostname: string, timeoutMs: number = 3000): Promise<string[] | null> {
  // Check if we're in Node.js environment with dns module available
  try {
    // Dynamic import to avoid bundler issues in browser environments
    const dns = await import('dns').catch(() => null);
    if (!dns?.promises?.lookup) {
      return null; // DNS resolution not available
    }

    // Use Promise.race for timeout protection
    const resolvePromise = dns.promises.lookup(hostname, { all: true })
      .then((results: Array<{ address: string }>) => results.map(r => r.address));

    const timeoutPromise = new Promise<string[]>((_, reject) => {
      setTimeout(() => reject(new Error('DNS resolution timeout')), timeoutMs);
    });

    return await Promise.race([resolvePromise, timeoutPromise]);
  } catch {
    // DNS module not available or resolution failed
    return null;
  }
}

/**
 * Check if hostname resolves to a private IP (SSRF protection)
 * Now performs actual DNS resolution when available to prevent DNS rebinding attacks
 */
async function isHostnamePrivate(hostname: string): Promise<boolean> {
  // Check common localhost aliases
  const localhostAliases = ['localhost', 'localhost.localdomain', '127.0.0.1', '::1', '[::1]'];
  if (localhostAliases.includes(hostname.toLowerCase())) {
    return true;
  }

  // Check for IP literal in hostname
  const ipLiteralMatch = hostname.match(/^\[?([0-9a-f.:]+)\]?$/i);
  if (ipLiteralMatch) {
    return isPrivateIP(ipLiteralMatch[1]);
  }

  // Check for suspicious domain patterns first (quick check before DNS)
  const suspiciousPatterns = [
    /\.local$/i,
    /\.internal$/i,
    /\.private$/i,
    /\.corp$/i,
    /\.lan$/i,
    /^metadata\./i,
    /^internal\./i,
    /\.consul$/i,
    /kubernetes\.default/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(hostname)) return true;
  }

  // SECURITY: Perform actual DNS resolution to catch DNS rebinding attacks
  // An attacker could set up a hostname that initially resolves to a public IP
  // but later rebinds to a private IP like 169.254.169.254 (cloud metadata)
  const resolvedIPs = await resolveHostname(hostname);
  if (resolvedIPs) {
    for (const ip of resolvedIPs) {
      if (isPrivateIP(ip)) {
        return true; // Hostname resolves to a private IP
      }
    }
  }

  return false;
}

interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a webhook URL for SSRF protection
 */
async function validateWebhookUrl(
  url: string,
  allowInsecureHttp: boolean = false
): Promise<UrlValidationResult> {
  try {
    const parsed = new URL(url);

    // Scheme validation
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'Only HTTP(S) URLs are allowed' };
    }

    if (parsed.protocol === 'http:' && !allowInsecureHttp) {
      return { valid: false, error: 'HTTPS is required for webhook URLs. Enable allowInsecureHttp for development only.' };
    }

    // Check for credentials in URL (security risk)
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with embedded credentials are not allowed' };
    }

    // Check hostname for private/internal addresses
    const hostname = parsed.hostname;
    if (await isHostnamePrivate(hostname)) {
      return { valid: false, error: 'Webhook URLs cannot point to private/internal addresses' };
    }

    // Block metadata service endpoints explicitly
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: false, error: 'Cloud metadata service endpoints are blocked' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// =============================================================================
// WEBHOOK DELIVERY
// =============================================================================

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Build and send a webhook payload
 * @param url - The webhook URL (must pass SSRF validation)
 * @param payload - The webhook payload to send
 * @param secret - Optional HMAC signing secret
 * @param allowInsecureHttp - Allow HTTP URLs (development only)
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string,
  allowInsecureHttp: boolean = false
): Promise<{ ok: boolean; status: number; error?: string }> {
  // SSRF Protection: Validate URL before making request
  const validation = await validateWebhookUrl(url, allowInsecureHttp);
  if (!validation.valid) {
    return { ok: false, status: 0, error: `URL validation failed: ${validation.error}` };
  }

  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CFP-Directory-Webhook/1.0',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
  };

  // Add HMAC signature if secret is configured
  if (secret) {
    const signature = await computeHmac(secret, body);
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  return { ok: response.ok, status: response.status };
}

/**
 * Compute HMAC-SHA256 signature
 */
async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if an event is enabled in the config
 */
function isEventEnabled(config: WebhookConfig, eventName: string): boolean {
  // If no events array specified, all events are enabled
  if (!config.events || config.events.length === 0) {
    return true;
  }
  return config.events.includes(eventName);
}

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

const plugin: Plugin = {
  manifest,

  async onEnable(ctx: PluginContext) {
    const config = ctx.config as WebhookConfig;

    // Register job handler for webhook retries
    if (ctx.jobs) {
      ctx.jobs.registerHandler('webhook-retry', async (payload) => {
        const currentConfig = ctx.config as WebhookConfig;
        const { url, webhookPayload, allowInsecureHttp } = payload as {
          url: string;
          webhookPayload: WebhookPayload;
          allowInsecureHttp?: boolean;
        };

        // Read secret from current config at execution time (security: not stored in job)
        const secret = currentConfig.secret;

        const result = await sendWebhook(url, webhookPayload, secret, allowInsecureHttp);
        if (!result.ok) {
          const errorDetail = result.error || `HTTP ${result.status}`;
          throw new Error(`Webhook retry failed: ${errorDetail}`);
        }

        ctx.logger.info('Webhook retry succeeded', {
          event: webhookPayload.event,
        });

        return { success: true };
      });
    }

    if (!config.webhookUrl) {
      ctx.logger.warn('Webhook plugin enabled without a URL configured');
    } else {
      ctx.logger.info('Webhook plugin enabled', {
        eventsFilter: config.events || 'all',
      });
    }
  },

  async onDisable(ctx: PluginContext) {
    // Unregister job handler
    if (ctx.jobs) {
      ctx.jobs.unregisterHandler('webhook-retry');
    }
    ctx.logger.info('Webhook plugin disabled');
  },

  hooks: {
    'submission.created': async (ctx, payload) => {
      const config = ctx.config as WebhookConfig;
      if (!config.webhookUrl || !isEventEnabled(config, 'submission.created')) {
        return;
      }

      // Build payload data - only include speaker PII if explicitly enabled
      const payloadData: Record<string, unknown> = {
        submissionId: payload.submission.id,
        title: payload.submission.title,
        status: payload.submission.status,
        eventName: payload.event.name,
        eventSlug: payload.event.slug,
      };

      // PII is opt-in only - requires explicit configuration
      if (config.includeSpeakerPii === true) {
        payloadData.speakerEmail = payload.speaker.email;
        payloadData.speakerName = payload.speaker.name;
      } else {
        // Include speaker ID only (non-PII identifier)
        payloadData.speakerId = payload.speaker.id;
      }

      const webhookPayload: WebhookPayload = {
        event: 'submission.created',
        timestamp: new Date().toISOString(),
        data: payloadData,
      };

      try {
        const result = await sendWebhook(
          config.webhookUrl,
          webhookPayload,
          config.secret,
          config.allowInsecureHttp
        );
        if (!result.ok) {
          const errorDetail = result.error || `HTTP ${result.status}`;
          throw new Error(`Webhook failed: ${errorDetail}`);
        }
        ctx.logger.info('Webhook sent: submission.created', {
          submissionId: payload.submission.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Webhook delivery failed', { error: message });

        // Retry via background job if enabled (Task #9: don't store secret in job)
        if (config.retryOnFailure !== false && ctx.jobs) {
          await ctx.jobs.enqueue({
            type: 'webhook-retry',
            payload: {
              url: config.webhookUrl,
              webhookPayload,
              useConfigSecret: true, // Reference to config, not the secret itself
              allowInsecureHttp: config.allowInsecureHttp,
            },
            maxAttempts: 3,
          });
        }
      }
    },

    'submission.statusChanged': async (ctx, payload) => {
      const config = ctx.config as WebhookConfig;
      if (!config.webhookUrl || !isEventEnabled(config, 'submission.statusChanged')) {
        return;
      }

      const webhookPayload: WebhookPayload = {
        event: 'submission.statusChanged',
        timestamp: new Date().toISOString(),
        data: {
          submissionId: payload.submission.id,
          title: payload.submission.title,
          oldStatus: payload.oldStatus,
          newStatus: payload.newStatus,
          changedById: payload.changedBy.id,
        },
      };

      try {
        const result = await sendWebhook(
          config.webhookUrl,
          webhookPayload,
          config.secret,
          config.allowInsecureHttp
        );
        if (!result.ok) {
          const errorDetail = result.error || `HTTP ${result.status}`;
          throw new Error(`Webhook failed: ${errorDetail}`);
        }
        ctx.logger.info('Webhook sent: submission.statusChanged', {
          submissionId: payload.submission.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Webhook delivery failed', { error: message });

        if (config.retryOnFailure !== false && ctx.jobs) {
          await ctx.jobs.enqueue({
            type: 'webhook-retry',
            payload: {
              url: config.webhookUrl,
              webhookPayload,
              useConfigSecret: true, // Reference to config, not the secret itself
              allowInsecureHttp: config.allowInsecureHttp,
            },
            maxAttempts: 3,
          });
        }
      }
    },

    'review.submitted': async (ctx, payload) => {
      const config = ctx.config as WebhookConfig;
      if (!config.webhookUrl || !isEventEnabled(config, 'review.submitted')) {
        return;
      }

      // Build payload - only include reviewer name if PII is enabled
      const payloadData: Record<string, unknown> = {
        reviewId: payload.review.id,
        submissionId: payload.submission.id,
        submissionTitle: payload.submission.title,
        isUpdate: payload.isUpdate,
        overallScore: payload.review.overallScore,
        recommendation: payload.review.recommendation,
      };

      // PII is opt-in only
      if (config.includeSpeakerPii === true) {
        payloadData.reviewerName = payload.reviewer.name;
      } else {
        payloadData.reviewerId = payload.reviewer.id;
      }

      const webhookPayload: WebhookPayload = {
        event: 'review.submitted',
        timestamp: new Date().toISOString(),
        data: payloadData,
      };

      try {
        const result = await sendWebhook(
          config.webhookUrl,
          webhookPayload,
          config.secret,
          config.allowInsecureHttp
        );
        if (!result.ok) {
          const errorDetail = result.error || `HTTP ${result.status}`;
          throw new Error(`Webhook failed: ${errorDetail}`);
        }
        ctx.logger.info('Webhook sent: review.submitted', {
          reviewId: payload.review.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error('Webhook delivery failed', { error: message });

        if (config.retryOnFailure !== false && ctx.jobs) {
          await ctx.jobs.enqueue({
            type: 'webhook-retry',
            payload: {
              url: config.webhookUrl,
              webhookPayload,
              useConfigSecret: true, // Reference to config, not the secret itself
              allowInsecureHttp: config.allowInsecureHttp,
            },
            maxAttempts: 3,
          });
        }
      }
    },
  },
};

export default plugin;
