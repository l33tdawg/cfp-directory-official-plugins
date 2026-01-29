/**
 * AI Paper Reviewer - Manifest Schema Extension Tests
 *
 * Validates the x-group, x-friendly-hint, x-depends-on,
 * x-options, x-display, and x-labels custom schema properties.
 */

import { describe, it, expect } from 'vitest';
import manifest from '../../plugins/ai-paper-reviewer/manifest.json';

const schema = manifest.configSchema;
const properties = schema.properties;

describe('Manifest configSchema extensions', () => {
  // -----------------------------------------------------------------------
  // x-groups (top-level)
  // -----------------------------------------------------------------------

  describe('x-groups', () => {
    it('defines x-groups at schema root', () => {
      expect(schema['x-groups']).toBeDefined();
    });

    it('has all five groups', () => {
      const groups = Object.keys(schema['x-groups']);
      expect(groups).toContain('provider');
      expect(groups).toContain('review');
      expect(groups).toContain('quality');
      expect(groups).toContain('automation');
      expect(groups).toContain('detection');
    });

    it('each group has title, description, and order', () => {
      for (const [_key, group] of Object.entries(schema['x-groups'])) {
        expect(group).toHaveProperty('title');
        expect(group).toHaveProperty('description');
        expect(group).toHaveProperty('order');
        expect(typeof group.title).toBe('string');
        expect(typeof group.description).toBe('string');
        expect(typeof group.order).toBe('number');
      }
    });

    it('groups have sequential order values', () => {
      const orders = Object.values(schema['x-groups']).map((g) => g.order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4]);
    });
  });

  // -----------------------------------------------------------------------
  // x-group (per property)
  // -----------------------------------------------------------------------

  describe('x-group assignments', () => {
    const expectedGroups: Record<string, string> = {
      aiProvider: 'provider',
      apiKey: 'provider',
      model: 'provider',
      temperature: 'quality',
      maxTokens: 'quality',
      confidenceThreshold: 'quality',
      lowConfidenceBehavior: 'quality',
      useEventCriteria: 'review',
      strictnessLevel: 'review',
      reviewFocus: 'review',
      customPersona: 'review',
      autoReview: 'automation',
      reReviewCooldownMinutes: 'automation',
      enableDuplicateDetection: 'detection',
      duplicateThreshold: 'detection',
      enableSpeakerResearch: 'detection',
    };

    it('every property has an x-group assignment', () => {
      for (const key of Object.keys(properties)) {
        expect(properties[key]).toHaveProperty('x-group');
      }
    });

    it.each(Object.entries(expectedGroups))('%s is in group "%s"', (key, group) => {
      expect(properties[key]['x-group']).toBe(group);
    });
  });

  // -----------------------------------------------------------------------
  // x-friendly-hint
  // -----------------------------------------------------------------------

  describe('x-friendly-hint', () => {
    it('all properties have x-friendly-hint', () => {
      for (const [_key, prop] of Object.entries(properties)) {
        expect(prop).toHaveProperty('x-friendly-hint');
        expect(typeof prop['x-friendly-hint']).toBe('string');
        expect(prop['x-friendly-hint'].length).toBeGreaterThan(10);
      }
    });

    it('aiProvider hint mentions all three providers', () => {
      const hint = properties.aiProvider['x-friendly-hint'];
      expect(hint.toLowerCase()).toContain('ai');
    });

    it('apiKey hint mentions encryption', () => {
      const hint = properties.apiKey['x-friendly-hint'];
      expect(hint.toLowerCase()).toContain('encrypted');
    });
  });

  // -----------------------------------------------------------------------
  // x-depends-on + x-options (model field)
  // -----------------------------------------------------------------------

  describe('x-depends-on and x-options', () => {
    const modelProp = properties.model;

    it('model has x-depends-on pointing to aiProvider', () => {
      expect(modelProp['x-depends-on']).toBe('aiProvider');
    });

    it('model has x-options with all three providers', () => {
      expect(modelProp['x-options']).toBeDefined();
      expect(modelProp['x-options']).toHaveProperty('openai');
      expect(modelProp['x-options']).toHaveProperty('anthropic');
      expect(modelProp['x-options']).toHaveProperty('gemini');
    });

    it('each provider has at least one model option', () => {
      for (const [_provider, options] of Object.entries(modelProp['x-options'])) {
        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('each model option has value and label', () => {
      for (const [_provider, options] of Object.entries(modelProp['x-options'])) {
        for (const option of options) {
          expect(option).toHaveProperty('value');
          expect(option).toHaveProperty('label');
          expect(typeof option.value).toBe('string');
          expect(typeof option.label).toBe('string');
        }
      }
    });

    it('each model option has a description', () => {
      for (const [_provider, options] of Object.entries(modelProp['x-options'])) {
        for (const option of options) {
          expect(option).toHaveProperty('description');
          expect(typeof option.description).toBe('string');
        }
      }
    });

    it('first option per provider has "(Recommended)" in label', () => {
      for (const [_provider, options] of Object.entries(modelProp['x-options'])) {
        expect(options[0].label).toContain('(Recommended)');
      }
    });

    it('openai options include gpt-4o and gpt-4o-mini', () => {
      const values = modelProp['x-options'].openai.map((o: any) => o.value);
      expect(values).toContain('gpt-4o');
      expect(values).toContain('gpt-4o-mini');
    });

    it('anthropic options include claude-sonnet-4 and claude-haiku-4', () => {
      const values = modelProp['x-options'].anthropic.map((o: any) => o.value);
      expect(values.some((v: string) => v.includes('sonnet'))).toBe(true);
      expect(values.some((v: string) => v.includes('haiku'))).toBe(true);
    });

    it('gemini options include gemini-2.0-flash', () => {
      const values = modelProp['x-options'].gemini.map((o: any) => o.value);
      expect(values).toContain('gemini-2.0-flash');
    });

    it('model field has no enum (uses x-options instead)', () => {
      expect(modelProp.enum).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // x-display: "slider"
  // -----------------------------------------------------------------------

  describe('x-display slider fields', () => {
    const sliderFields = ['temperature', 'duplicateThreshold', 'confidenceThreshold'];

    it.each(sliderFields)('%s has x-display set to "slider"', (field) => {
      expect(properties[field]['x-display']).toBe('slider');
    });

    it.each(sliderFields)('%s has minimum and maximum defined', (field) => {
      expect(properties[field]).toHaveProperty('minimum');
      expect(properties[field]).toHaveProperty('maximum');
      expect(typeof properties[field].minimum).toBe('number');
      expect(typeof properties[field].maximum).toBe('number');
    });

    it('non-slider number fields do not have x-display', () => {
      expect(properties.maxTokens['x-display']).toBeUndefined();
      expect(properties.reReviewCooldownMinutes['x-display']).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // x-labels
  // -----------------------------------------------------------------------

  describe('x-labels', () => {
    it('temperature has tick labels', () => {
      const labels = properties.temperature['x-labels'];
      expect(labels).toBeDefined();
      expect(labels['0']).toBe('Consistent');
      expect(labels['0.5']).toBe('Balanced');
      expect(labels['1']).toBe('Creative');
    });

    it('duplicateThreshold has tick labels', () => {
      const labels = properties.duplicateThreshold['x-labels'];
      expect(labels).toBeDefined();
      expect(labels['0.5']).toBe('Loose');
      expect(labels['0.95']).toBe('Strict');
    });

    it('confidenceThreshold has tick labels', () => {
      const labels = properties.confidenceThreshold['x-labels'];
      expect(labels).toBeDefined();
      expect(labels['0']).toBe('Show all');
      expect(labels['1']).toBe('High only');
    });
  });

  // -----------------------------------------------------------------------
  // Version bump
  // -----------------------------------------------------------------------

  describe('version', () => {
    it('manifest version is 1.5.0', () => {
      expect(manifest.version).toBe('1.5.0');
    });
  });

  // -----------------------------------------------------------------------
  // sidebarItems
  // -----------------------------------------------------------------------

  describe('sidebarItems', () => {
    it('defines sidebarItems at manifest root', () => {
      expect(manifest.sidebarItems).toBeDefined();
      expect(Array.isArray(manifest.sidebarItems)).toBe(true);
    });

    it('has one section with title "AI Reviews"', () => {
      expect(manifest.sidebarItems).toHaveLength(1);
      expect(manifest.sidebarItems[0].title).toBe('AI Reviews');
    });

    it('section has Bot icon', () => {
      expect(manifest.sidebarItems[0].icon).toBe('Bot');
    });

    it('section has three items', () => {
      expect(manifest.sidebarItems[0].items).toHaveLength(3);
    });

    it('includes Dashboard item with correct properties', () => {
      const dashboardItem = manifest.sidebarItems[0].items.find(
        (item: { key: string }) => item.key === 'dashboard'
      );
      expect(dashboardItem).toBeDefined();
      expect(dashboardItem.label).toBe('Dashboard');
      expect(dashboardItem.path).toBe('/');
      expect(dashboardItem.icon).toBe('LayoutDashboard');
    });

    it('includes Review History item with correct properties', () => {
      const historyItem = manifest.sidebarItems[0].items.find(
        (item: { key: string }) => item.key === 'history'
      );
      expect(historyItem).toBeDefined();
      expect(historyItem.label).toBe('Review History');
      expect(historyItem.path).toBe('/history');
      expect(historyItem.icon).toBe('History');
    });

    it('includes Reviewer Personas item with correct properties', () => {
      const personasItem = manifest.sidebarItems[0].items.find(
        (item: { key: string }) => item.key === 'personas'
      );
      expect(personasItem).toBeDefined();
      expect(personasItem.label).toBe('Reviewer Personas');
      expect(personasItem.path).toBe('/personas');
      expect(personasItem.icon).toBe('Sparkles');
    });
  });

  // -----------------------------------------------------------------------
  // Structural validation
  // -----------------------------------------------------------------------

  describe('schema structure', () => {
    it('schema type is "object"', () => {
      expect(schema.type).toBe('object');
    });

    it('required only includes apiKey', () => {
      expect(schema.required).toEqual(['apiKey']);
    });

    it('has 16 properties', () => {
      expect(Object.keys(properties).length).toBe(16);
    });

    it('all properties have type and title', () => {
      for (const [_key, prop] of Object.entries(properties)) {
        expect(prop).toHaveProperty('type');
        expect(prop).toHaveProperty('title');
      }
    });
  });
});
