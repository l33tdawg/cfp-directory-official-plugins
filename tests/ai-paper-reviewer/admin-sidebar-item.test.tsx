/**
 * AI Reviewer Admin Sidebar Item Tests
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Bot: () => <span data-testid="icon-bot" />,
  History: () => <span data-testid="icon-history" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Settings: () => <span data-testid="icon-settings" />,
}));

// Mock plugin types
vi.mock('@/lib/plugins', () => ({
  // Types are compile-time only, no runtime mock needed
}));

import { AiReviewerSidebarItem } from '../../plugins/ai-paper-reviewer/components/admin-sidebar-item';
import type { ClientPluginContext } from '@/lib/plugins';

const mockContext: ClientPluginContext = {
  pluginName: 'ai-paper-reviewer',
  pluginId: 'db-id',
  config: {},
};

describe('AiReviewerSidebarItem', () => {
  it('should render sidebar section with AI Reviews header', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{ pathname: '/admin', pluginBasePath: '/admin/plugins' }}
      />
    );

    expect(screen.getByTestId('ai-reviewer-sidebar')).toBeInTheDocument();
    expect(screen.getByText('AI Reviews')).toBeInTheDocument();
  });

  it('should render all navigation links', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{ pathname: '/admin', pluginBasePath: '/admin/plugins' }}
      />
    );

    expect(screen.getByText('Review History')).toBeInTheDocument();
    expect(screen.getByText('Reviewer Personas')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should build correct hrefs using pluginBasePath', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{ pathname: '/admin', pluginBasePath: '/admin/plugins/pages' }}
      />
    );

    const historyLink = screen.getByTestId('sidebar-link-review-history');
    const personasLink = screen.getByTestId('sidebar-link-reviewer-personas');
    const settingsLink = screen.getByTestId('sidebar-link-settings');

    expect(historyLink).toHaveAttribute('href', '/admin/plugins/pages/ai-paper-reviewer/history');
    expect(personasLink).toHaveAttribute('href', '/admin/plugins/pages/ai-paper-reviewer/personas');
    expect(settingsLink).toHaveAttribute('href', '/admin/plugins/pages/ai-paper-reviewer/settings');
  });

  it('should highlight Review History link when on history page', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{
          pathname: '/admin/plugins/pages/ai-paper-reviewer/history',
          pluginBasePath: '/admin/plugins/pages',
        }}
      />
    );

    const historyLink = screen.getByTestId('sidebar-link-review-history');
    expect(historyLink.className).toContain('bg-purple-100');
  });

  it('should highlight Personas link when on personas page', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{
          pathname: '/admin/plugins/pages/ai-paper-reviewer/personas',
          pluginBasePath: '/admin/plugins/pages',
        }}
      />
    );

    const personasLink = screen.getByTestId('sidebar-link-reviewer-personas');
    expect(personasLink.className).toContain('bg-purple-100');
  });

  it('should highlight Settings link when on settings page', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{
          pathname: '/admin/plugins/pages/ai-paper-reviewer/settings',
          pluginBasePath: '/admin/plugins/pages',
        }}
      />
    );

    const settingsLink = screen.getByTestId('sidebar-link-settings');
    expect(settingsLink.className).toContain('bg-purple-100');
  });

  it('should not highlight links when on different page', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{
          pathname: '/admin/plugins',
          pluginBasePath: '/admin/plugins/pages',
        }}
      />
    );

    const historyLink = screen.getByTestId('sidebar-link-review-history');
    const personasLink = screen.getByTestId('sidebar-link-reviewer-personas');
    const settingsLink = screen.getByTestId('sidebar-link-settings');

    expect(historyLink.className).not.toContain('bg-purple-100');
    expect(personasLink.className).not.toContain('bg-purple-100');
    expect(settingsLink.className).not.toContain('bg-purple-100');
  });

  it('should render icons', () => {
    render(
      <AiReviewerSidebarItem
        context={mockContext}
        data={{ pathname: '/admin', pluginBasePath: '/admin/plugins' }}
      />
    );

    expect(screen.getByTestId('icon-bot')).toBeInTheDocument();
    expect(screen.getByTestId('icon-history')).toBeInTheDocument();
    expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
    expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
  });

  it('should handle missing data gracefully', () => {
    render(<AiReviewerSidebarItem context={mockContext} data={undefined} />);

    // Should still render with default paths
    expect(screen.getByTestId('ai-reviewer-sidebar')).toBeInTheDocument();
    const historyLink = screen.getByTestId('sidebar-link-review-history');
    expect(historyLink).toHaveAttribute('href', '/admin/plugins/pages/ai-paper-reviewer/history');
  });
});
