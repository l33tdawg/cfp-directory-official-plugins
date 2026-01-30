/**
 * Example Webhook Plugin - Security Tests
 * Tests for SSRF protection, PII handling, and secret management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import the plugin to test internal functions
// We need to test the URL validation and webhook sending
const webhookModule = await import('../../plugins/example-webhook/index');

describe('Webhook Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSRF Protection - URL Validation', () => {
    // We'll test sendWebhook which now validates URLs

    // Note: Tests use HTTPS URLs to test SSRF protection (HTTPS check happens first)
    it('should reject localhost URLs', async () => {
      const result = await webhookModule.sendWebhook(
        'https://localhost:8080/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject 127.0.0.1 URLs', async () => {
      const result = await webhookModule.sendWebhook(
        'https://127.0.0.1:8080/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject private IP ranges (10.x.x.x)', async () => {
      const result = await webhookModule.sendWebhook(
        'https://10.0.0.5:8080/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject private IP ranges (172.16-31.x.x)', async () => {
      const result = await webhookModule.sendWebhook(
        'https://172.16.0.1/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject private IP ranges (192.168.x.x)', async () => {
      const result = await webhookModule.sendWebhook(
        'https://192.168.1.1/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject link-local addresses (169.254.x.x)', async () => {
      const result = await webhookModule.sendWebhook(
        'https://169.254.169.254/latest/meta-data/',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      // Link-local addresses are caught by the private IP check
      expect(result.error).toMatch(/private|internal|metadata/i);
    });

    it('should reject cloud metadata endpoints explicitly', async () => {
      const result = await webhookModule.sendWebhook(
        'https://metadata.google.internal/computeMetadata/v1/',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      // metadata.google.internal is caught by the .internal domain check
      expect(result.error).toMatch(/private|internal|metadata/i);
    });

    it('should reject IPv6 loopback', async () => {
      const result = await webhookModule.sendWebhook(
        'https://[::1]:8080/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject .local domains', async () => {
      const result = await webhookModule.sendWebhook(
        'https://myserver.local/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject .internal domains', async () => {
      const result = await webhookModule.sendWebhook(
        'https://service.internal/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject HTTP URLs by default (require HTTPS)', async () => {
      const result = await webhookModule.sendWebhook(
        'http://example.com/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('should allow HTTP URLs when allowInsecureHttp is true', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const result = await webhookModule.sendWebhook(
        'http://example.com/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} },
        undefined,
        true // allowInsecureHttp
      );

      expect(result.ok).toBe(true);
    });

    it('should allow valid HTTPS URLs to public hosts', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const result = await webhookModule.sendWebhook(
        'https://webhook.example.com/endpoint',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(true);
      expect(fetch).toHaveBeenCalled();
    });

    it('should reject URLs with embedded credentials', async () => {
      const result = await webhookModule.sendWebhook(
        'https://user:password@example.com/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('credentials');
    });

    it('should reject non-HTTP(S) schemes', async () => {
      const result = await webhookModule.sendWebhook(
        'ftp://example.com/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('HTTP');
    });

    it('should reject invalid URL format', async () => {
      const result = await webhookModule.sendWebhook(
        'not-a-valid-url',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject Kubernetes internal domains', async () => {
      const result = await webhookModule.sendWebhook(
        'https://kubernetes.default.svc.cluster.local/api',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });

    it('should reject Consul service discovery domains', async () => {
      const result = await webhookModule.sendWebhook(
        'https://myservice.service.consul/webhook',
        { event: 'test', timestamp: new Date().toISOString(), data: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('private/internal');
    });
  });

  describe('HMAC Signature', () => {
    it('should add signature header when secret is provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await webhookModule.sendWebhook(
        'https://example.com/webhook',
        { event: 'test', timestamp: '2024-01-01T00:00:00Z', data: { id: '123' } },
        'my-secret'
      );

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it('should not add signature header when no secret', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await webhookModule.sendWebhook(
        'https://example.com/webhook',
        { event: 'test', timestamp: '2024-01-01T00:00:00Z', data: {} }
      );

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

      expect(headers['X-Webhook-Signature']).toBeUndefined();
    });
  });
});
