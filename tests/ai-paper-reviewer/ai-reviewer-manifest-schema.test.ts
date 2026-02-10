/**
 * AI Paper Reviewer - Manifest Structure Tests
 *
 * Validates manifest.json structure after config migration.
 * configSchema has been removed — plugin now manages its own settings
 * via save-settings / get-settings actions and ctx.data.
 */

import { describe, it, expect } from 'vitest';
import manifest from '../../plugins/ai-paper-reviewer/manifest.json';

describe('Manifest structure', () => {
  // -----------------------------------------------------------------------
  // Version
  // -----------------------------------------------------------------------

  describe('version', () => {
    it('manifest version is 1.39.0', () => {
      expect(manifest.version).toBe('1.39.0');
    });
  });

  // -----------------------------------------------------------------------
  // configSchema removed
  // -----------------------------------------------------------------------

  describe('configSchema', () => {
    it('does not have configSchema (plugin manages its own settings)', () => {
      expect((manifest as Record<string, unknown>).configSchema).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  describe('actions', () => {
    it('defines actions array', () => {
      expect(manifest.actions).toBeDefined();
      expect(Array.isArray(manifest.actions)).toBe(true);
    });

    it('has save-settings action', () => {
      const action = manifest.actions.find(
        (a: { name: string }) => a.name === 'save-settings'
      );
      expect(action).toBeDefined();
      expect(action.title).toBe('Save Settings');
    });

    it('has get-settings action', () => {
      const action = manifest.actions.find(
        (a: { name: string }) => a.name === 'get-settings'
      );
      expect(action).toBeDefined();
      expect(action.title).toBe('Get Settings');
    });

    it('has list-models action', () => {
      const action = manifest.actions.find(
        (a: { name: string }) => a.name === 'list-models'
      );
      expect(action).toBeDefined();
    });

    it('has reset-budget action', () => {
      const action = manifest.actions.find(
        (a: { name: string }) => a.name === 'reset-budget'
      );
      expect(action).toBeDefined();
      expect(action.title).toBe('Reset Budget');
    });

    it('has get-cost-stats action', () => {
      const action = manifest.actions.find(
        (a: { name: string }) => a.name === 'get-cost-stats'
      );
      expect(action).toBeDefined();
      expect(action.title).toBe('Get Cost Statistics');
    });

    it('each action has name, title, and description', () => {
      for (const action of manifest.actions) {
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('title');
        expect(action).toHaveProperty('description');
        expect(typeof action.name).toBe('string');
        expect(typeof action.title).toBe('string');
        expect(typeof action.description).toBe('string');
      }
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

    it('section has four items', () => {
      expect(manifest.sidebarItems[0].items).toHaveLength(4);
    });

    it('includes Dashboard item with correct properties', () => {
      const item = manifest.sidebarItems[0].items.find(
        (i: { key: string }) => i.key === 'dashboard'
      );
      expect(item).toBeDefined();
      expect(item.label).toBe('Dashboard');
      expect(item.path).toBe('/dashboard');
      expect(item.icon).toBe('LayoutDashboard');
    });

    it('includes Review History item with correct properties', () => {
      const item = manifest.sidebarItems[0].items.find(
        (i: { key: string }) => i.key === 'history'
      );
      expect(item).toBeDefined();
      expect(item.label).toBe('Review History');
      expect(item.path).toBe('/history');
      expect(item.icon).toBe('History');
    });

    it('includes Reviewer Personas item with correct properties', () => {
      const item = manifest.sidebarItems[0].items.find(
        (i: { key: string }) => i.key === 'personas'
      );
      expect(item).toBeDefined();
      expect(item.label).toBe('Reviewer Personas');
      expect(item.path).toBe('/personas');
      expect(item.icon).toBe('Sparkles');
    });

    it('includes Settings item with correct properties', () => {
      const item = manifest.sidebarItems[0].items.find(
        (i: { key: string }) => i.key === 'settings'
      );
      expect(item).toBeDefined();
      expect(item.label).toBe('Settings');
      expect(item.path).toBe('/settings');
      expect(item.icon).toBe('Settings');
    });
  });

  // -----------------------------------------------------------------------
  // adminPages
  // -----------------------------------------------------------------------

  describe('adminPages', () => {
    it('defines adminPages array', () => {
      expect(manifest.adminPages).toBeDefined();
      expect(Array.isArray(manifest.adminPages)).toBe(true);
    });

    it('has four admin pages', () => {
      expect(manifest.adminPages).toHaveLength(4);
    });

    it('includes Dashboard page', () => {
      const page = manifest.adminPages.find(
        (p: { path: string }) => p.path === '/dashboard'
      );
      expect(page).toBeDefined();
      expect(page.title).toBe('Dashboard');
      expect(page.component).toBe('AdminDashboard');
    });

    it('includes Review History page', () => {
      const page = manifest.adminPages.find(
        (p: { path: string }) => p.path === '/history'
      );
      expect(page).toBeDefined();
      expect(page.title).toBe('Review History');
      expect(page.component).toBe('AdminReviewHistory');
    });

    it('includes Reviewer Personas page', () => {
      const page = manifest.adminPages.find(
        (p: { path: string }) => p.path === '/personas'
      );
      expect(page).toBeDefined();
      expect(page.title).toBe('Reviewer Personas');
      expect(page.component).toBe('AdminPersonas');
    });

    it('includes Settings page', () => {
      const page = manifest.adminPages.find(
        (p: { path: string }) => p.path === '/settings'
      );
      expect(page).toBeDefined();
      expect(page.title).toBe('Settings');
      expect(page.component).toBe('AdminSettings');
    });

    it('sidebar paths match adminPages paths', () => {
      const sidebarPaths = manifest.sidebarItems[0].items.map(
        (i: { path: string }) => i.path
      );
      const adminPaths = manifest.adminPages.map(
        (p: { path: string }) => p.path
      );
      for (const path of sidebarPaths) {
        expect(adminPaths).toContain(path);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Basic metadata
  // -----------------------------------------------------------------------

  describe('metadata', () => {
    it('has correct plugin name', () => {
      expect(manifest.name).toBe('ai-paper-reviewer');
    });

    it('has API version 1.0', () => {
      expect(manifest.apiVersion).toBe('1.0');
    });

    it('has required permissions', () => {
      expect(manifest.permissions).toContain('submissions:read');
      expect(manifest.permissions).toContain('reviews:write');
      expect(manifest.permissions).toContain('events:read');
    });

    it('declares hooks', () => {
      expect(manifest.hooks).toContain('submission.created');
      expect(manifest.hooks).toContain('submission.updated');
    });
  });
});
