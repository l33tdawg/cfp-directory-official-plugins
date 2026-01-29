/**
 * AI Review History Admin Page Tests
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
  History: () => <span data-testid="icon-history" />,
  RefreshCw: ({ className }: any) => <span data-testid="icon-refresh" className={className} />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  FileText: () => <span data-testid="icon-file" />,
}));

// Mock plugin types
vi.mock('@/lib/plugins', () => ({}));

import { AdminReviewHistory } from '../../plugins/ai-paper-reviewer/components/admin-review-history';
import type { ClientPluginContext } from '@/lib/plugins';

const mockContext: ClientPluginContext = {
  pluginName: 'ai-paper-reviewer',
  pluginId: 'plugin-123',
  config: {},
};

const mockCompletedJob = {
  id: 'job-1',
  type: 'ai-review',
  status: 'completed',
  createdAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:01:00Z',
  payload: { title: 'Great Talk', submissionId: 'sub-1' },
  result: {
    success: true,
    data: {
      submissionId: 'sub-1',
      analysis: {
        overallScore: 4,
        recommendation: 'ACCEPT',
        confidence: 0.85,
        summary: 'Good submission',
        strengths: ['Clear', 'Well-structured'],
        weaknesses: ['Missing examples'],
      },
      analyzedAt: '2024-01-15T10:01:00Z',
      provider: 'openai',
      model: 'gpt-4o',
    },
  },
};

const mockFailedJob = {
  id: 'job-2',
  type: 'ai-review',
  status: 'failed',
  createdAt: '2024-01-15T09:00:00Z',
  completedAt: '2024-01-15T09:00:30Z',
  payload: { title: 'Failed Talk', submissionId: 'sub-2' },
  result: {
    success: false,
    error: 'API rate limit exceeded',
  },
};

describe('AdminReviewHistory', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('status=completed')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobs: [mockCompletedJob] }),
        } as Response);
      }
      if (urlStr.includes('status=failed')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobs: [mockFailedJob] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      } as Response);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render page header', async () => {
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByText('Review History')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    // Should show loading spinner
    const refreshIcon = screen.getAllByTestId('icon-refresh')[0];
    expect(refreshIcon).toHaveClass('animate-spin');
  });

  it('should display jobs after loading', async () => {
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Great Talk')).toBeInTheDocument();
    expect(screen.getByText('Failed Talk')).toBeInTheDocument();
  });

  it('should show filter tabs with counts', async () => {
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-tabs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('filter-all')).toHaveTextContent('All (2)');
    expect(screen.getByTestId('filter-completed')).toHaveTextContent('Completed (1)');
    expect(screen.getByTestId('filter-failed')).toHaveTextContent('Failed (1)');
  });

  it('should filter jobs when clicking filter buttons', async () => {
    const user = userEvent.setup();
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });

    // Click "Completed" filter
    await user.click(screen.getByTestId('filter-completed'));

    // Should only show completed job
    expect(screen.getByText('Great Talk')).toBeInTheDocument();
    expect(screen.queryByText('Failed Talk')).not.toBeInTheDocument();

    // Click "Failed" filter
    await user.click(screen.getByTestId('filter-failed'));

    // Should only show failed job
    expect(screen.queryByText('Great Talk')).not.toBeInTheDocument();
    expect(screen.getByText('Failed Talk')).toBeInTheDocument();
  });

  it('should display job details correctly', async () => {
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });

    // Check completed job row
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('ACCEPT')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should expand row to show details when clicked', async () => {
    const user = userEvent.setup();
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('job-row-job-1')).toBeInTheDocument();
    });

    // Click to expand
    await user.click(screen.getByTestId('job-row-job-1'));

    // Should show details
    await waitFor(() => {
      expect(screen.getByTestId('job-details-job-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Good submission')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('Well-structured')).toBeInTheDocument();
    expect(screen.getByText('Missing examples')).toBeInTheDocument();
  });

  it('should show error for failed jobs in details', async () => {
    const user = userEvent.setup();
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('job-row-job-2')).toBeInTheDocument();
    });

    // Click to expand failed job
    await user.click(screen.getByTestId('job-row-job-2'));

    await waitFor(() => {
      expect(screen.getByTestId('job-details-job-2')).toBeInTheDocument();
    });

    expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });

    // Clear fetch mock call count
    vi.mocked(fetch).mockClear();

    // Click refresh
    await user.click(screen.getByTestId('refresh-button'));

    // Should fetch again
    expect(fetch).toHaveBeenCalled();
  });

  it('should show error message on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no jobs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [] }),
    } as Response);

    render(<AdminReviewHistory context={mockContext} data={{}} />);

    await waitFor(() => {
      expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    });
  });
});
