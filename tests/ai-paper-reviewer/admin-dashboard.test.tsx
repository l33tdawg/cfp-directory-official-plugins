/**
 * AI Paper Reviewer Dashboard Tests
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <span data-testid="icon-dashboard" />,
  RefreshCw: ({ className }: { className?: string }) => (
    <span data-testid="icon-refresh" className={className} />
  ),
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  Clock: () => <span data-testid="icon-clock" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Settings: () => <span data-testid="icon-settings" />,
  History: () => <span data-testid="icon-history" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="icon-loader" className={className} />
  ),
  Key: () => <span data-testid="icon-key" />,
  Bot: () => <span data-testid="icon-bot" />,
  Play: () => <span data-testid="icon-play" />,
  PlayCircle: () => <span data-testid="icon-play-circle" />,
  FileText: () => <span data-testid="icon-file" />,
  RotateCcw: () => <span data-testid="icon-rotate-ccw" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  Trash2: () => <span data-testid="icon-trash" />,
  DollarSign: () => <span data-testid="icon-dollar" />,
  RotateCw: () => <span data-testid="icon-rotate-cw" />,
  // Icons for AdminOnboarding component
  Cpu: () => <span data-testid="icon-cpu" />,
  Zap: () => <span data-testid="icon-zap" />,
  BookOpen: () => <span data-testid="icon-book" />,
  Lightbulb: () => <span data-testid="icon-lightbulb" />,
  Scale: () => <span data-testid="icon-scale" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Check: () => <span data-testid="icon-check-simple" />,
}));

// Mock plugin types
vi.mock('@/lib/plugins', () => ({}));

import { AdminDashboard } from '../../plugins/ai-paper-reviewer/components/admin-dashboard';
import type { ClientPluginContext } from '@/lib/plugins';

// =============================================================================
// Test Data
// =============================================================================

// Create mock API helper that delegates to global fetch
const createMockApi = (pluginId: string) => ({
  baseUrl: `/api/plugins/${pluginId}`,
  fetch: async (path: string, options?: RequestInit) => {
    return fetch(`/api/plugins/${pluginId}${path}`, options);
  },
});

const mockContext: ClientPluginContext = {
  pluginName: 'ai-paper-reviewer',
  pluginId: 'plugin-123',
  config: {},
  api: createMockApi('plugin-123'),
};

const mockContextWithApiKey: ClientPluginContext = {
  ...mockContext,
  config: { apiKey: 'sk-test-key', aiProvider: 'openai', model: 'gpt-4o' },
  api: createMockApi('plugin-123'),
};

const mockContextGemini: ClientPluginContext = {
  ...mockContext,
  config: { aiProvider: 'gemini', model: 'gemini-2.0-flash' },
  api: createMockApi('plugin-123'),
};

const mockCompletedJob = {
  id: 'job-1',
  type: 'ai-review',
  status: 'completed',
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  payload: { title: 'Great Talk About AI', submissionId: 'sub-1' },
  result: {
    success: true,
    data: {
      submissionId: 'sub-1',
      analysis: {
        overallScore: 4,
        recommendation: 'ACCEPT',
        confidence: 0.85,
      },
      analyzedAt: new Date().toISOString(),
      provider: 'openai',
      model: 'gpt-4o',
    },
  },
};

const mockFailedJob = {
  id: 'job-2',
  type: 'ai-review',
  status: 'failed',
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  payload: { title: 'Failed Review', submissionId: 'sub-2' },
  result: {
    success: false,
    error: 'API rate limit exceeded',
  },
};

const mockPendingJob = {
  id: 'job-3',
  type: 'ai-review',
  status: 'pending',
  createdAt: new Date().toISOString(),
  completedAt: null,
  payload: { title: 'Pending Review', submissionId: 'sub-3' },
  result: null,
};

const mockRunningJob = {
  id: 'job-4',
  type: 'ai-review',
  status: 'running',
  createdAt: new Date().toISOString(),
  completedAt: null,
  payload: { title: 'Running Review', submissionId: 'sub-4' },
  result: null,
};

const mockUnreviewedSubmission = {
  id: 'sub-5',
  title: 'Unreviewed Submission',
  abstract: 'This is an abstract',
  status: 'submitted',
  createdAt: '2024-01-15T10:00:00Z',
  eventId: 'event-1',
  event: { id: 'event-1', name: 'TechConf 2024', slug: 'techconf-2024' },
  hasAiReview: false,
  aiReviewStatus: 'none',
  aiReview: null,
};

const mockSubmissionsResponse = {
  submissions: [mockUnreviewedSubmission],
  stats: { total: 10, reviewed: 5, pending: 2, unreviewed: 3 },
};

// =============================================================================
// Helper Functions
// =============================================================================

function createFetchMock(overrides: Record<string, unknown> = {}) {
  const defaults = {
    pending: { jobs: [] },
    running: { jobs: [] },
    completed: { jobs: [] },
    failed: { jobs: [] },
    submissions: { submissions: [], stats: { total: 0, reviewed: 0, pending: 0, unreviewed: 0 } },
    configValue: { value: true }, // Default to API key configured so dashboard shows
    costStats: { success: true, stats: null },
  };

  const data = { ...defaults, ...overrides };

  return vi.fn((url: string) => {
    const urlStr = url.toString();

    if (urlStr.includes('status=pending')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.pending),
      } as Response);
    }
    if (urlStr.includes('status=running')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.running),
      } as Response);
    }
    if (urlStr.includes('status=completed')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.completed),
      } as Response);
    }
    if (urlStr.includes('status=failed')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.failed),
      } as Response);
    }
    if (urlStr.includes('/submissions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.submissions),
      } as Response);
    }
    if (urlStr.includes('/data/config/api-key-configured')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.configValue),
      } as Response);
    }
    // Cost stats action
    if (urlStr.includes('/actions/get-cost-stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data.costStats),
      } as Response);
    }
    // POST for job queue
    if (urlStr.includes('/jobs') && !urlStr.includes('status=')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'new-job-123' }),
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(createFetchMock());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Basic Rendering
  // ---------------------------------------------------------------------------

  describe('Basic Rendering', () => {
    it('should render the dashboard header', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('AI Paper Reviewer Dashboard')).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      // Should show loading spinner
      const loaders = screen.getAllByTestId('icon-loader');
      expect(loaders.length).toBeGreaterThan(0);
    });

    it('should render all stat cards after loading', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-stats-card')).toBeInTheDocument();
        expect(screen.getByTestId('review-stats-card')).toBeInTheDocument();
        expect(screen.getByTestId('job-queue-card')).toBeInTheDocument();
        expect(screen.getByTestId('quick-actions-card')).toBeInTheDocument();
      });
    });

    it('should render recent activity section', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
        // Text includes count in parentheses, e.g., "Recent Reviews (0)"
        expect(screen.getByText(/Recent Reviews/)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // API Key Configuration Status
  // ---------------------------------------------------------------------------

  describe('API Key Configuration Status', () => {
    it('should show "API Configured" when server flag indicates key is set', async () => {
      // Component relies on server-side flag, not context.config.apiKey (security)
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: true } })
      );

      render(<AdminDashboard context={mockContextWithApiKey} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('API Configured')).toBeInTheDocument();
        expect(screen.getByText(/Using openai/)).toBeInTheDocument();
        expect(screen.getByText(/gpt-4o/)).toBeInTheDocument();
      });
    });

    it('should show "API Configured" when api-key-configured flag is true', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: true } })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('API Configured')).toBeInTheDocument();
      });
    });

    it('should show onboarding wizard when flag is explicitly false', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: false } })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        // When API key is not configured, onboarding wizard is shown
        expect(screen.getByTestId('admin-onboarding')).toBeInTheDocument();
        expect(screen.getByText('AI Paper Reviewer Setup')).toBeInTheDocument();
      });
    });

    it('should show onboarding wizard when config flag returns null value', async () => {
      // When configRes returns { value: null }, apiKeyConfigured becomes false
      // (because null === true is false), so it shows the onboarding wizard
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: null } })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        // When the flag is not explicitly true, shows onboarding
        expect(screen.getByTestId('admin-onboarding')).toBeInTheDocument();
      });
    });

    it('should display correct provider and model from config', async () => {
      // Need API key to be configured to show provider/model
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: true } })
      );

      render(<AdminDashboard context={mockContextGemini} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText(/gemini/)).toBeInTheDocument();
        expect(screen.getByText(/gemini-2.0-flash/)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Stats Display
  // ---------------------------------------------------------------------------

  describe('Stats Display', () => {
    it('should display submission stats correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ submissions: mockSubmissionsResponse })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const card = screen.getByTestId('submission-stats-card');
        expect(within(card).getByText('10')).toBeInTheDocument(); // Total
        expect(within(card).getByText('5')).toBeInTheDocument(); // Reviewed
        expect(within(card).getByText('3')).toBeInTheDocument(); // Unreviewed
      });
    });

    it('should display job queue stats correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          pending: { jobs: [mockPendingJob, mockPendingJob] },
          running: { jobs: [mockRunningJob] },
          completed: { jobs: [mockCompletedJob] },
          failed: { jobs: [mockFailedJob] },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const card = screen.getByTestId('job-queue-card');
        // Check for pending count (2)
        const pendingRow = within(card).getByText('Pending').closest('div');
        expect(pendingRow).toBeInTheDocument();
        // Check for running count
        const runningRow = within(card).getByText('Running').closest('div');
        expect(runningRow).toBeInTheDocument();
      });
    });

    it('should calculate review stats correctly', async () => {
      const job1 = { ...mockCompletedJob, result: { ...mockCompletedJob.result, data: { ...mockCompletedJob.result.data, analysis: { overallScore: 4 } } } };
      const job2 = { ...mockCompletedJob, id: 'job-2', result: { ...mockCompletedJob.result, data: { ...mockCompletedJob.result.data, analysis: { overallScore: 3 } } } };

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          completed: { jobs: [job1, job2] },
          failed: { jobs: [mockFailedJob] },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const card = screen.getByTestId('review-stats-card');
        expect(within(card).getByText('3')).toBeInTheDocument(); // Total (2 completed + 1 failed)
        expect(within(card).getByText('66.7%')).toBeInTheDocument(); // Success rate
        expect(within(card).getByText('3.5/5')).toBeInTheDocument(); // Average score
      });
    });

    it('should show dash for avg score when no completed reviews', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(createFetchMock());

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const card = screen.getByTestId('review-stats-card');
        expect(within(card).getByText('-')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Review Queue
  // ---------------------------------------------------------------------------

  describe('Review Queue', () => {
    it('should display review queue when there are unreviewed submissions', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('review-queue')).toBeInTheDocument();
        expect(screen.getByText('Review Queue (3 unreviewed)')).toBeInTheDocument();
      });
    });

    it('should not show review queue when no unreviewed submissions', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: { submissions: [], stats: { total: 5, reviewed: 5, pending: 0, unreviewed: 0 } },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('config-status')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('review-queue')).not.toBeInTheDocument();
    });

    it('should display submission details in queue', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Unreviewed Submission')).toBeInTheDocument();
        expect(screen.getByText(/TechConf 2024/)).toBeInTheDocument();
      });
    });

    it('should show "Review All" button when API key is configured', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText(/Review All/)).toBeInTheDocument();
      });
    });

    it('should show "Review All" button when server flag indicates key is set', async () => {
      // Component relies on server-side flag, not context.config.apiKey (security)
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContextWithApiKey} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText(/Review All/)).toBeInTheDocument();
      });
    });

    it('should show onboarding wizard (not review queue) when API key is explicitly not configured', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: false },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        // When API key is not configured, onboarding is shown instead of dashboard
        expect(screen.getByTestId('admin-onboarding')).toBeInTheDocument();
      });

      // Dashboard elements shouldn't be visible
      expect(screen.queryByTestId('review-queue')).not.toBeInTheDocument();
      expect(screen.queryByText(/Review All/)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Review Actions
  // ---------------------------------------------------------------------------

  describe('Review Actions', () => {
    it('should queue individual review when clicking Review button', async () => {
      const user = userEvent.setup();
      const fetchMock = createFetchMock({
        submissions: mockSubmissionsResponse,
        configValue: { value: true },
      });
      vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Unreviewed Submission')).toBeInTheDocument();
      });

      const reviewButton = screen.getByRole('button', { name: /Review$/ });
      await user.click(reviewButton);

      // Should have called fetch with POST to queue the job
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/jobs'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sub-5'),
        })
      );
    });

    it('should show onboarding (not review buttons) when API key is known to be missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: false },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        // Onboarding is shown instead of dashboard when API key is not configured
        expect(screen.getByTestId('admin-onboarding')).toBeInTheDocument();
      });

      // Dashboard review button is not visible
      expect(screen.queryByRole('button', { name: /^Review$/ })).not.toBeInTheDocument();
    });

    it('should enable Review button when server flag indicates key is set', async () => {
      // Component relies on server-side flag, not context.config.apiKey (security)
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContextWithApiKey} data={{}} />);

      await waitFor(() => {
        const reviewButton = screen.getByRole('button', { name: /Review$/ });
        expect(reviewButton).not.toBeDisabled();
      });
    });

    it('should show onboarding (not Review All button) when API key is not configured', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: false },
        })
      );

      // Render with context that doesn't have apiKey
      render(<AdminDashboard context={mockContext} data={{}} />);

      // Wait for the onboarding to show
      await waitFor(() => {
        expect(screen.getByTestId('admin-onboarding')).toBeInTheDocument();
      });

      // Dashboard elements should not be visible when onboarding is shown
      expect(screen.queryByText(/Review All/)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Recent Reviews
  // ---------------------------------------------------------------------------

  describe('Recent Reviews', () => {
    it('should display recent reviews', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          completed: { jobs: [mockCompletedJob] },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Great Talk About AI')).toBeInTheDocument();
        expect(screen.getByText('4/5')).toBeInTheDocument();
        expect(screen.getByText('ACCEPT')).toBeInTheDocument();
      });
    });

    it('should show empty state when no reviews', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(createFetchMock());

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(
          screen.getByText('No reviews completed yet. Reviews will appear here once submissions are analyzed.')
        ).toBeInTheDocument();
      });
    });

    it('should display recommendation with correct formatting', async () => {
      const jobWithStrongAccept = {
        ...mockCompletedJob,
        result: {
          ...mockCompletedJob.result,
          data: {
            ...mockCompletedJob.result.data,
            analysis: { overallScore: 5, recommendation: 'STRONG_ACCEPT' },
          },
        },
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          completed: { jobs: [jobWithStrongAccept] },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('STRONG ACCEPT')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Actions Links
  // ---------------------------------------------------------------------------

  describe('Quick Actions Links', () => {
    it('should have correct History link', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const historyLink = screen.getByRole('link', { name: /History/ });
        expect(historyLink).toHaveAttribute(
          'href',
          '/admin/plugins/pages/ai-paper-reviewer/history'
        );
      });
    });

    it('should have correct Personas link', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const personasLink = screen.getByRole('link', { name: /Personas/ });
        expect(personasLink).toHaveAttribute(
          'href',
          '/admin/plugins/pages/ai-paper-reviewer/personas'
        );
      });
    });

    it('should have correct Settings link', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const settingsLink = screen.getByRole('link', { name: /Settings/ });
        // Component uses context.pluginId for settings link
        expect(settingsLink).toHaveAttribute('href', `/admin/plugins/${mockContext.pluginId}`);
      });
    });

    it('should use custom pluginBasePath from data', async () => {
      render(
        <AdminDashboard
          context={mockContext}
          data={{ pluginBasePath: '/custom/path' }}
        />
      );

      await waitFor(() => {
        const historyLink = screen.getByRole('link', { name: /History/ });
        expect(historyLink).toHaveAttribute('href', '/custom/path/ai-paper-reviewer/history');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should show error message on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show error when job queue POST fails', async () => {
      const user = userEvent.setup();

      // First, successful fetch for data loading
      vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
        const _urlStr = url.toString();

        // POST request for queuing job - return error
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Queue failed' }),
          } as Response);
        }

        // Other requests - normal mock
        return createFetchMock({
          submissions: mockSubmissionsResponse,
          configValue: { value: true },
        })(url as string);
      });

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Unreviewed Submission')).toBeInTheDocument();
      });

      const reviewButton = screen.getByRole('button', { name: /Review$/ });
      await user.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText('Queue failed')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh Functionality
  // ---------------------------------------------------------------------------

  describe('Refresh Functionality', () => {
    it('should refresh data when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const fetchMock = createFetchMock();
      vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('config-status')).toBeInTheDocument();
      });

      // Clear previous calls
      fetchMock.mockClear();

      // Click refresh
      await user.click(screen.getByTestId('refresh-button'));

      // Should make fetch calls again
      expect(fetchMock).toHaveBeenCalled();
    });

    it('should disable refresh button while loading', async () => {
      render(<AdminDashboard context={mockContext} data={{}} />);

      // During initial load, button should be disabled
      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle empty jobs arrays gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          pending: { jobs: null },
          running: {},
          completed: { jobs: undefined },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        const card = screen.getByTestId('job-queue-card');
        // Should show 0 for all stats
        const zeros = within(card).getAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should handle submissions endpoint failure gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/submissions')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed' }),
          } as Response);
        }
        return createFetchMock()(url as string);
      });

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        // Should still render without crashing
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      });
    });

    it('should show truncation message for more than 10 unreviewed submissions', async () => {
      const manySubmissions = Array.from({ length: 15 }, (_, i) => ({
        ...mockUnreviewedSubmission,
        id: `sub-${i}`,
        title: `Submission ${i}`,
      }));

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({
          submissions: {
            submissions: manySubmissions,
            stats: { total: 15, reviewed: 0, pending: 0, unreviewed: 15 },
          },
          configValue: { value: true },
        })
      );

      render(<AdminDashboard context={mockContext} data={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Showing first 10 of 15 unreviewed submissions')).toBeInTheDocument();
      });
    });

    it('should use default values for missing config', async () => {
      // When config is empty and flag returns false, shows "not configured"
      // But when API key IS configured, it shows the default provider/model
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        createFetchMock({ configValue: { value: true } }) // Simulate API key being set
      );

      render(<AdminDashboard context={{ ...mockContext, config: {} }} data={{}} />);

      await waitFor(() => {
        // Should use default provider/model (text may be split across elements)
        expect(screen.getByText('API Configured')).toBeInTheDocument();
        expect(screen.getByText(/openai/)).toBeInTheDocument();
        expect(screen.getByText(/gpt-4o/)).toBeInTheDocument();
      });
    });
  });
});
