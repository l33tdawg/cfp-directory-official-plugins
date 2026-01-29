'use client';

/**
 * AI Review History Admin Page
 *
 * Displays a table of all completed AI review jobs with filtering capabilities.
 * Shows date, submission, score, recommendation, confidence, and status.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

type FilterStatus = 'all' | 'completed' | 'failed';

interface JobResult {
  success: boolean;
  data?: {
    submissionId: string;
    analysis: {
      overallScore: number;
      recommendation: string;
      confidence: number;
      summary?: string;
      strengths?: string[];
      weaknesses?: string[];
    };
    analyzedAt: string;
    provider: string;
    model: string;
  };
  error?: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  result: JobResult | null;
  createdAt: string;
  completedAt: string | null;
  payload: Record<string, unknown>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="h-3 w-3" />
        Completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
      {status}
    </span>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const styles: Record<string, string> = {
    STRONG_ACCEPT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    ACCEPT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    NEUTRAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    REJECT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    STRONG_REJECT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const style = styles[recommendation] || styles.NEUTRAL;

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {recommendation.replace(/_/g, ' ')}
    </span>
  );
}

function ExpandableRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const result = job.result;
  const analysis = result?.data?.analysis;
  const payload = job.payload as { title?: string; submissionId?: string };

  return (
    <>
      <tr
        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`job-row-${job.id}`}
      >
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
          {job.completedAt
            ? new Date(job.completedAt).toLocaleString()
            : new Date(job.createdAt).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm">
          <div className="max-w-xs truncate font-medium text-slate-900 dark:text-white" title={payload.title || payload.submissionId || '-'}>
            {payload.title || payload.submissionId || '-'}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-center">
          {analysis?.overallScore !== undefined ? (
            <span className="font-semibold text-slate-900 dark:text-white">{analysis.overallScore}/5</span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          {analysis?.recommendation ? (
            <RecommendationBadge recommendation={analysis.recommendation} />
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-center">
          {analysis?.confidence !== undefined ? (
            <span
              className={`font-medium ${
                analysis.confidence >= 0.7
                  ? 'text-green-600 dark:text-green-400'
                  : analysis.confidence >= 0.5
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {Math.round(analysis.confidence * 100)}%
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge status={job.status} />
        </td>
        <td className="px-4 py-3 text-sm text-center">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400 inline" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 inline" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 dark:bg-slate-800/30" data-testid={`job-details-${job.id}`}>
          <td colSpan={7} className="px-6 py-4">
            {result?.success && analysis ? (
              <div className="space-y-4 text-sm">
                {analysis.summary && (
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Summary</span>
                    <span className="text-slate-600 dark:text-slate-400">{analysis.summary}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.strengths && analysis.strengths.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-semibold text-green-700 dark:text-green-300 block mb-2">Strengths</span>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.strengths.map((s, i) => (
                          <li key={i} className="text-slate-600 dark:text-slate-400">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                      <span className="font-semibold text-red-700 dark:text-red-300 block mb-2">Weaknesses</span>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.weaknesses.map((w, i) => (
                          <li key={i} className="text-slate-600 dark:text-slate-400">{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                  Provider: {result.data?.provider}/{result.data?.model} | Job ID: {job.id}
                </div>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <span className="font-semibold">Error: </span>
                {result?.error || 'Unknown error'}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminReviewHistory({ context }: PluginComponentProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch completed and failed jobs
      const [completedRes, failedRes] = await Promise.all([
        fetch(`/api/plugins/${context.pluginId}/jobs?status=completed&type=ai-review&limit=100`),
        fetch(`/api/plugins/${context.pluginId}/jobs?status=failed&type=ai-review&limit=100`),
      ]);

      if (!completedRes.ok || !failedRes.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const completedData = await completedRes.json();
      const failedData = await failedRes.json();

      const allJobs = [...(completedData.jobs || []), ...(failedData.jobs || [])];
      // Sort by completedAt desc, then createdAt desc
      allJobs.sort((a, b) => {
        const dateA = a.completedAt || a.createdAt;
        const dateB = b.completedAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setJobs(allJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [context.pluginId]); // fetchJobs is stable

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = jobs.filter((j) => j.status === 'completed');
    const failed = jobs.filter((j) => j.status === 'failed');
    const totalScores = completed
      .map((j) => j.result?.data?.analysis?.overallScore)
      .filter((s): s is number => typeof s === 'number');
    const avgScore = totalScores.length > 0
      ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length
      : 0;
    const successRate = jobs.length > 0 ? (completed.length / jobs.length) * 100 : 0;

    return {
      total: jobs.length,
      completed: completed.length,
      failed: failed.length,
      avgScore,
      successRate,
    };
  }, [jobs]);

  return (
    <div className="space-y-6" data-testid="admin-review-history">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Review History</h1>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          data-testid="refresh-button"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Summary</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Reviews</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.successRate.toFixed(0)}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Success Rate</div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '-'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Avg Score</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Failed</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2" data-testid="filter-tabs">
        {(['all', 'completed', 'failed'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === status
                ? 'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
            data-testid={`filter-${status}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${jobs.length})`}
            {status === 'completed' && ` (${jobs.filter((j) => j.status === 'completed').length})`}
            {status === 'failed' && ` (${jobs.filter((j) => j.status === 'failed').length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
              {filter === 'all' ? 'No reviews yet' : `No ${filter} reviews`}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === 'all'
                ? 'AI reviews will appear here once submissions are analyzed.'
                : `There are no ${filter} reviews to display.`}
            </p>
          </div>
        ) : (
          <table className="w-full" data-testid="history-table">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Submission
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Recommendation
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <ExpandableRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
