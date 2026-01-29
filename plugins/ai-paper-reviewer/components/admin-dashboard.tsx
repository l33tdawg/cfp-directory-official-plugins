'use client';

/**
 * AI Paper Reviewer Dashboard
 *
 * Main admin dashboard showing review stats, job queue status,
 * configuration status, review queue, and quick actions.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Settings,
  History,
  Sparkles,
  Loader2,
  Key,
  Bot,
  Play,
  PlayCircle,
  FileText,
} from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

interface JobStats {
  pending: number;
  running: number;
  completedToday: number;
  failedToday: number;
}

interface ReviewStats {
  totalReviews: number;
  successRate: number;
  averageScore: number;
}

interface RecentReview {
  id: string;
  title: string;
  score: number | null;
  recommendation: string | null;
  status: string;
  completedAt: string | null;
}

interface UnreviewedSubmission {
  id: string;
  title: string;
  abstract: string;
  status: string;
  createdAt: string;
  eventId: string;
  event: { id: string; name: string };
  speaker: { id: string; name: string };
  aiReview: {
    status: 'unreviewed' | 'pending' | 'running' | 'reviewed';
    jobId?: string;
    score?: number | null;
    recommendation?: string | null;
  };
}

interface SubmissionStats {
  total: number;
  reviewed: number;
  pending: number;
  unreviewed: number;
}

export function AdminDashboard({ context }: PluginComponentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobStats, setJobStats] = useState<JobStats>({
    pending: 0,
    running: 0,
    completedToday: 0,
    failedToday: 0,
  });
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    totalReviews: 0,
    successRate: 0,
    averageScore: 0,
  });
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [unreviewedSubmissions, setUnreviewedSubmissions] = useState<UnreviewedSubmission[]>([]);
  const [submissionStats, setSubmissionStats] = useState<SubmissionStats>({
    total: 0,
    reviewed: 0,
    pending: 0,
    unreviewed: 0,
  });
  const [queueingAll, setQueueingAll] = useState(false);
  const [queueingIds, setQueueingIds] = useState<Set<string>>(new Set());

  const hasApiKey = Boolean(context.config.apiKey);
  const provider = (context.config.aiProvider as string) || 'openai';
  const model = (context.config.model as string) || 'gpt-4o';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all job types and submissions in parallel
      const [pendingRes, runningRes, completedRes, failedRes, submissionsRes] = await Promise.all([
        fetch(`/api/plugins/${context.pluginId}/jobs?status=pending&type=ai-review&limit=100`),
        fetch(`/api/plugins/${context.pluginId}/jobs?status=running&type=ai-review&limit=100`),
        fetch(`/api/plugins/${context.pluginId}/jobs?status=completed&type=ai-review&limit=100`),
        fetch(`/api/plugins/${context.pluginId}/jobs?status=failed&type=ai-review&limit=100`),
        fetch(`/api/plugins/${context.pluginId}/submissions?limit=100`),
      ]);

      const [pendingData, runningData, completedData, failedData, submissionsData] = await Promise.all([
        pendingRes.json(),
        runningRes.json(),
        completedRes.json(),
        failedRes.json(),
        submissionsRes.ok ? submissionsRes.json() : { submissions: [], stats: { total: 0, reviewed: 0, pending: 0, unreviewed: 0 } },
      ]);

      const pendingJobs = pendingData.jobs || [];
      const runningJobs = runningData.jobs || [];
      const completedJobs = completedData.jobs || [];
      const failedJobs = failedData.jobs || [];

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = completedJobs.filter(
        (job: { completedAt: string }) =>
          job.completedAt && new Date(job.completedAt) >= today
      ).length;

      const failedToday = failedJobs.filter(
        (job: { completedAt: string }) =>
          job.completedAt && new Date(job.completedAt) >= today
      ).length;

      setJobStats({
        pending: pendingJobs.length,
        running: runningJobs.length,
        completedToday,
        failedToday,
      });

      // Calculate review stats
      const totalReviews = completedJobs.length + failedJobs.length;
      const successRate = totalReviews > 0 ? (completedJobs.length / totalReviews) * 100 : 0;

      let totalScore = 0;
      let scoreCount = 0;
      completedJobs.forEach((job: { result?: { data?: { analysis?: { overallScore?: number } } } }) => {
        const score = job.result?.data?.analysis?.overallScore;
        if (typeof score === 'number') {
          totalScore += score;
          scoreCount++;
        }
      });
      const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

      setReviewStats({
        totalReviews,
        successRate,
        averageScore,
      });

      // Get recent reviews (last 5 completed)
      const recent = completedJobs
        .slice(0, 5)
        .map((job: {
          id: string;
          payload: { title?: string };
          status: string;
          completedAt: string | null;
          result?: { data?: { analysis?: { overallScore?: number; recommendation?: string } } };
        }) => ({
          id: job.id,
          title: job.payload.title || 'Untitled',
          score: job.result?.data?.analysis?.overallScore ?? null,
          recommendation: job.result?.data?.analysis?.recommendation ?? null,
          status: job.status,
          completedAt: job.completedAt,
        }));

      setRecentReviews(recent);

      // Set submission data
      if (submissionsData.submissions) {
        const unreviewed = submissionsData.submissions.filter(
          (s: UnreviewedSubmission) => s.aiReview.status === 'unreviewed'
        );
        setUnreviewedSubmissions(unreviewed.slice(0, 10)); // Show first 10
        setSubmissionStats(submissionsData.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [context.pluginId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const queueReview = async (submission: UnreviewedSubmission) => {
    setQueueingIds((prev) => new Set(prev).add(submission.id));

    try {
      const response = await fetch(`/api/plugins/${context.pluginId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai-review',
          payload: {
            submissionId: submission.id,
            eventId: submission.eventId,
            title: submission.title,
            abstract: submission.abstract,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to queue review');
      }

      // Refresh data to show updated status
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue review');
    } finally {
      setQueueingIds((prev) => {
        const next = new Set(prev);
        next.delete(submission.id);
        return next;
      });
    }
  };

  const queueAllUnreviewed = async () => {
    if (!hasApiKey) {
      setError('Please configure your API key before queuing reviews');
      return;
    }

    setQueueingAll(true);
    setError(null);

    try {
      // Queue all unreviewed submissions
      for (const submission of unreviewedSubmissions) {
        await fetch(`/api/plugins/${context.pluginId}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ai-review',
            payload: {
              submissionId: submission.id,
              eventId: submission.eventId,
              title: submission.title,
              abstract: submission.abstract,
            },
          }),
        });
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue reviews');
    } finally {
      setQueueingAll(false);
    }
  };

  const getRecommendationColor = (rec: string | null) => {
    if (!rec) return 'text-slate-500';
    if (rec.includes('ACCEPT')) return 'text-green-600 dark:text-green-400';
    if (rec.includes('REJECT')) return 'text-red-600 dark:text-red-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            AI Paper Reviewer Dashboard
          </h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          data-testid="refresh-button"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
        </div>
      ) : (
        <>
          {/* Configuration Status */}
          <div
            className={`p-4 rounded-lg border ${
              hasApiKey
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}
            data-testid="config-status"
          >
            <div className="flex items-center gap-3">
              {hasApiKey ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      API Configured
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Using {provider} / {model}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      API Key Not Configured
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Configure your API key in the plugin settings to enable reviews
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Submission Stats Card */}
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="submission-stats-card">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Submissions
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {submissionStats.total}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-600 dark:text-green-400">Reviewed</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {submissionStats.reviewed}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-600 dark:text-amber-400">Unreviewed</span>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {submissionStats.unreviewed}
                  </span>
                </div>
              </div>
            </div>

            {/* Review Stats Card */}
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="review-stats-card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Review Stats
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total Reviews</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {reviewStats.totalReviews}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Success Rate</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {reviewStats.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Avg Score</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {reviewStats.averageScore > 0 ? `${reviewStats.averageScore.toFixed(1)}/5` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Job Queue Card */}
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="job-queue-card">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Job Queue
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {jobStats.pending}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3" /> Running
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {jobStats.running}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Today
                  </span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {jobStats.completedToday}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Failed Today
                  </span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {jobStats.failedToday}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="quick-actions-card">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Quick Actions
                </h3>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={`/admin/plugins/pages/ai-paper-reviewer/history`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <History className="h-4 w-4" />
                  History
                </a>
                <a
                  href={`/admin/plugins/pages/ai-paper-reviewer/personas`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Personas
                </a>
                <a
                  href={`/admin/plugins/ai-paper-reviewer`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </a>
              </div>
            </div>
          </div>

          {/* Review Queue - Unreviewed Submissions */}
          {submissionStats.unreviewed > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="review-queue">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Review Queue ({submissionStats.unreviewed} unreviewed)
                    </h3>
                  </div>
                  {hasApiKey && unreviewedSubmissions.length > 0 && (
                    <button
                      onClick={queueAllUnreviewed}
                      disabled={queueingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 transition-colors"
                    >
                      {queueingAll ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      Review All ({unreviewedSubmissions.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {unreviewedSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {submission.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {submission.event.name} | {submission.speaker.name} | {new Date(submission.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => queueReview(submission)}
                      disabled={!hasApiKey || queueingIds.has(submission.id)}
                      className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md hover:bg-purple-50 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {queueingIds.has(submission.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Review
                    </button>
                  </div>
                ))}
                {submissionStats.unreviewed > 10 && (
                  <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    Showing first 10 of {submissionStats.unreviewed} unreviewed submissions
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid="recent-activity">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Recent Reviews
                </h3>
              </div>
            </div>
            {recentReviews.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No reviews completed yet. Reviews will appear here once submissions are analyzed.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {review.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {review.completedAt
                          ? new Date(review.completedAt).toLocaleString()
                          : 'Pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {review.score !== null ? `${review.score}/5` : '-'}
                      </span>
                      <span
                        className={`text-xs font-medium ${getRecommendationColor(review.recommendation)}`}
                      >
                        {review.recommendation?.replace(/_/g, ' ') || '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
