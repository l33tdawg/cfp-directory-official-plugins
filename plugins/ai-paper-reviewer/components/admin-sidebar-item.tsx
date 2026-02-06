'use client';

/**
 * AI Reviewer Admin Sidebar Item
 *
 * Renders the "AI Reviews" section in the admin sidebar with links
 * to Review History and Reviewer Personas pages.
 */

import React from 'react';
import Link from 'next/link';
import { Bot, History, Sparkles, Settings } from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

function NavLink({ href, icon, label, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
      }`}
      data-testid={`sidebar-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function AiReviewerSidebarItem({ data }: PluginComponentProps) {
  const pathname = (data?.pathname as string) || '';
  const pluginBasePath = (data?.pluginBasePath as string) || '/admin/plugins/pages';

  const historyHref = `${pluginBasePath}/ai-paper-reviewer/history`;
  const personasHref = `${pluginBasePath}/ai-paper-reviewer/personas`;
  const settingsHref = `${pluginBasePath}/ai-paper-reviewer/settings`;

  const isHistoryActive = pathname.startsWith(historyHref);
  const isPersonasActive = pathname.startsWith(personasHref);
  const isSettingsActive = pathname.startsWith(settingsHref);

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-slate-700" data-testid="ai-reviewer-sidebar">
      <div className="flex items-center gap-2 px-3 py-2 mb-1">
        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          AI Reviews
        </span>
      </div>
      <nav className="space-y-1">
        <NavLink
          href={historyHref}
          icon={<History className="h-4 w-4" />}
          label="Review History"
          isActive={isHistoryActive}
        />
        <NavLink
          href={personasHref}
          icon={<Sparkles className="h-4 w-4" />}
          label="Reviewer Personas"
          isActive={isPersonasActive}
        />
        <NavLink
          href={settingsHref}
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          isActive={isSettingsActive}
        />
      </nav>
    </div>
  );
}
