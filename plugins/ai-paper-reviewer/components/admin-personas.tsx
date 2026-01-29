'use client';

/**
 * AI Reviewer Personas Admin Page
 *
 * Allows administrators to configure the AI reviewer's persona/style.
 * Provides quick preset buttons and a custom persona textarea.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  BookOpen,
  Lightbulb,
  Scale,
  Cpu,
  Info,
} from 'lucide-react';
import type { PluginComponentProps } from '@/lib/plugins';

interface Preset {
  id: string;
  name: string;
  description: string;
  persona: string;
  icon: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    id: 'technical',
    name: 'Technical Expert',
    description: 'Focuses on technical accuracy, depth, and rigor',
    persona:
      'You are a senior technical reviewer with deep expertise. Focus on technical accuracy, code quality, architectural decisions, and implementation feasibility. Be rigorous but constructive. Pay special attention to scalability, performance, and security considerations.',
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    id: 'educator',
    name: 'Educator',
    description: 'Emphasizes clarity, learning value, and audience fit',
    persona:
      'You are an experienced educator and conference speaker. Focus on how well the content will be understood by the target audience. Evaluate clarity of explanations, logical flow, and educational value. Consider whether the prerequisites are appropriate and if the content builds knowledge effectively.',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: 'innovation',
    name: 'Innovation Scout',
    description: 'Prioritizes novelty, creativity, and fresh perspectives',
    persona:
      'You are an innovation-focused reviewer looking for fresh ideas and novel approaches. Prioritize submissions that bring new perspectives, challenge conventional thinking, or introduce emerging technologies. Be open to unconventional formats and experimental topics while ensuring basic quality standards are met.',
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    id: 'balanced',
    name: 'Balanced Reviewer',
    description: 'Well-rounded review covering all aspects equally',
    persona:
      'You are a balanced reviewer who evaluates all aspects of a submission equally. Consider technical merit, presentation quality, originality, and relevance to the conference audience. Provide constructive feedback that helps authors improve their submissions regardless of your final recommendation.',
    icon: <Scale className="h-5 w-5" />,
  },
];

export function AdminPersonas({ context }: PluginComponentProps) {
  const currentPersona = (context.config.customPersona as string) || '';

  const [persona, setPersona] = useState(currentPersona);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Detect which preset is active based on current persona
  useEffect(() => {
    const currentValue = (context.config.customPersona as string) || '';
    setPersona(currentValue);

    const matchingPreset = PRESETS.find((p) => p.persona === currentValue);
    setActivePreset(matchingPreset?.id || null);
  }, [context.config.customPersona]);

  const handlePresetClick = (preset: Preset) => {
    setPersona(preset.persona);
    setActivePreset(preset.id);
    setSaveStatus('idle');
  };

  const handleTextareaChange = (value: string) => {
    setPersona(value);
    // Check if this matches any preset
    const matchingPreset = PRESETS.find((p) => p.persona === value);
    setActivePreset(matchingPreset?.id || null);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setError(null);

    try {
      // Merge with existing config to preserve other settings
      const updatedConfig = {
        ...context.config,
        customPersona: persona,
      };

      const response = await fetch(`/api/admin/plugins/${context.pluginId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: updatedConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = persona !== currentPersona;

  return (
    <div className="space-y-6" data-testid="admin-personas">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reviewer Personas</h1>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Customize the AI reviewer&apos;s personality and focus areas. Select a preset or write your own custom persona instructions.
      </p>

      {/* Preset Cards */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Quick Presets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="presets-grid">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={`relative p-4 text-left rounded-lg transition-all ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-2 border-purple-500 dark:border-purple-400 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/20'
                }`}
                data-testid={`preset-${preset.id}`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {preset.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${
                      isActive ? 'text-purple-900 dark:text-purple-100' : 'text-slate-900 dark:text-white'
                    }`}>
                      {preset.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {preset.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Persona Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Custom Persona Instructions
          </h2>
          {activePreset && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              <CheckCircle className="h-3 w-3" />
              {PRESETS.find((p) => p.id === activePreset)?.name}
            </span>
          )}
        </div>
        <textarea
          value={persona}
          onChange={(e) => handleTextareaChange(e.target.value)}
          placeholder="Enter custom instructions for the AI reviewer... For example: 'Focus on practical applicability and real-world examples. Be especially thorough with methodology sections.'"
          className="w-full h-40 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
          data-testid="persona-textarea"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {persona.length} characters
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasChanges
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
          data-testid="save-button"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
        </button>

        {persona && (
          <button
            onClick={() => {
              setPersona('');
              setActivePreset(null);
              setSaveStatus('idle');
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            data-testid="clear-button"
          >
            Clear
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              How Personas Work
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              The persona instructions are prepended to every AI review request. They guide the AI&apos;s
              focus, tone, and evaluation criteria. A good persona is specific about what to prioritize
              (e.g., &quot;focus on technical depth&quot;) and how to communicate feedback (e.g., &quot;be
              constructive and encouraging&quot;). Changes take effect immediately for new reviews.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
