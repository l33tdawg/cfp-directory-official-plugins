/**
 * AI Reviewer Personas Admin Page Tests
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Save: () => <span data-testid="icon-save" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Loader2: ({ className }: any) => <span data-testid="icon-loader" className={className} />,
  BookOpen: () => <span data-testid="icon-book" />,
  Lightbulb: () => <span data-testid="icon-lightbulb" />,
  Scale: () => <span data-testid="icon-scale" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  Info: () => <span data-testid="icon-info" />,
}));

// Mock plugin types
vi.mock('@/lib/plugins', () => ({}));

import { AdminPersonas } from '../../plugins/ai-paper-reviewer/components/admin-personas';
import type { ClientPluginContext } from '@/lib/plugins';

const createMockContext = (customPersona?: string): ClientPluginContext => ({
  pluginName: 'ai-paper-reviewer',
  pluginId: 'plugin-123',
  config: {
    customPersona: customPersona || '',
  },
});

describe('AdminPersonas', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render page header', () => {
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    expect(screen.getByText('Reviewer Personas')).toBeInTheDocument();
    expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
  });

  it('should render preset buttons', () => {
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    expect(screen.getByTestId('presets-grid')).toBeInTheDocument();
    expect(screen.getByTestId('preset-technical')).toBeInTheDocument();
    expect(screen.getByTestId('preset-educator')).toBeInTheDocument();
    expect(screen.getByTestId('preset-innovation')).toBeInTheDocument();
    expect(screen.getByTestId('preset-balanced')).toBeInTheDocument();
  });

  it('should populate textarea when preset button is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    await user.click(screen.getByTestId('preset-technical'));

    const textarea = screen.getByTestId('persona-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('technical reviewer');
  });

  it('should show current persona from config', () => {
    const customPersona = 'My custom reviewer instructions';
    render(<AdminPersonas context={createMockContext(customPersona)} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe(customPersona);
  });

  it('should show "unsaved changes" when textarea is modified', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona text');

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('should enable save button when there are changes', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeDisabled();

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona text');

    expect(saveButton).not.toBeDisabled();
  });

  it('should call API to save configuration', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona');

    await user.click(screen.getByTestId('save-button'));

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/plugins/plugin-123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ config: { customPersona: 'New persona' } }),
      })
    );
  });

  it('should show success state after saving', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona');

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });
  });

  it('should show error message on save failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Save failed' }),
    } as Response);

    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona');

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('should clear textarea when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext('Existing persona')} data={{}} />);

    expect(screen.getByTestId('clear-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('clear-button'));

    const textarea = screen.getByTestId('persona-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('should show character count', async () => {
    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'Hello');

    expect(screen.getByText('5 characters')).toBeInTheDocument();
  });

  it('should show info box explaining how personas work', () => {
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    expect(screen.getByText('How Personas Work')).toBeInTheDocument();
    expect(screen.getByText(/prepended to every AI review request/)).toBeInTheDocument();
  });

  it('should show loading state while saving', async () => {
    // Create a delayed promise to see loading state
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response), 100))
    );

    const user = userEvent.setup();
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    const textarea = screen.getByTestId('persona-textarea');
    await user.type(textarea, 'New persona');

    await user.click(screen.getByTestId('save-button'));

    // Should show loading
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();

    // Wait for save to complete
    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });
  });

  it('should not show clear button when textarea is empty', () => {
    render(<AdminPersonas context={createMockContext()} data={{}} />);

    expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
  });
});
