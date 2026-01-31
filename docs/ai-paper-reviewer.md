# AI Paper Reviewer Plugin

> **Current Version:** 1.13.0
> **Plugin API Version:** 1.0
> **Requires:** Plugin System v1.13.0+
> **Status:** Production Ready
> **Repository:** `cfp-directory-official-plugins`

This document describes the AI Paper Reviewer plugin, which automatically analyzes CFP submissions using AI to provide preliminary review scores, feedback, and recommendations based on the event's configured review criteria.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Speaker Context](#speaker-context)
- [Admin Dashboard](#admin-dashboard)
- [Privacy & Security](#privacy--security)
- [Troubleshooting](#troubleshooting)

---

## Overview

The AI Paper Reviewer plugin acts as an automated program committee member, providing intelligent analysis of talk submissions. Key characteristics:

- **Uses the event's configured review criteria** - Scores align with what human reviewers evaluate
- **Configurable strictness** - Lenient, Moderate, or Strict review standards
- **Speaker context awareness** - Considers speaker bio, experience, and expertise (v1.13.0+)
- **Duplicate detection** - Identifies similar submissions within the event
- **Confidence levels** - Knows when it's uncertain and flags low-confidence results
- **Multi-provider support** - OpenAI, Anthropic (Claude), and Google Gemini

### Why a Plugin?

| Concern | Plugin Approach |
|---------|-----------------|
| **Cost** | Only organizations that want AI review pay for API calls |
| **Privacy** | Some orgs may not want submissions sent to external AI |
| **Provider Choice** | Users can pick OpenAI, Anthropic, or Google |
| **Modularity** | Can be disabled/removed without affecting core functionality |
| **Updates** | Plugin updates independently of the main application |

---

## Features

### Current Features (v1.13.0)

- **Multi-provider support**: OpenAI, Anthropic (Claude), Google Gemini
- **Dynamic model selection**: Fetches available models from your provider
- **Event-aware criteria**: Uses the event's configured review criteria and weights
- **Speaker profile context**: Includes speaker bio, experience level, expertise tags, and social profiles
- **Co-speaker support**: Considers all speakers when reviewing
- **Configurable strictness**: Lenient, Moderate, or Strict review standards
- **Duplicate detection**: Identifies similar submissions within the event
- **Confidence thresholds**: Flag or hide unreliable recommendations
- **Custom personas**: Define custom reviewer personas
- **Re-review capability**: Re-analyze submissions after updates
- **Auto-review**: Automatically review new submissions
- **Review history**: View all AI reviews with filtering
- **Admin dashboard**: Statistics, job status, and recent reviews

### Privacy Features

- **No email sent to AI**: Speaker email addresses are never sent to AI providers
- **Public info only**: Only publicly-available information (name, bio, social handles) is shared
- **Local processing**: Duplicate detection runs locally, not via AI

---

## Installation

### From the Gallery (Recommended)

1. Go to **Admin > Plugins**
2. Find "AI Paper Reviewer" in the Official Plugins gallery
3. Click **Install** and acknowledge the security warning
4. Configure your API key and preferences
5. Click **Enable**

### Manual Installation

1. Download the plugin from [GitHub Releases](https://github.com/l33tdawg/cfp-directory-official-plugins/releases)
2. Extract to `plugins/ai-paper-reviewer/`
3. Restart the application
4. Go to **Admin > Plugins** and enable

---

## Configuration

### Required Settings

| Setting | Description |
|---------|-------------|
| **AI Provider** | OpenAI, Anthropic, or Gemini |
| **API Key** | Your provider's API key (stored encrypted) |

### Review Style Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Model** | gpt-4o | AI model to use (options loaded from provider) |
| **Review Strictness** | Moderate | How critical the AI should be |
| **Use Event Criteria** | Yes | Match reviews to event's scoring criteria |

### Automation Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Auto-Review** | Yes | Automatically review new submissions |
| **Show AI on Team Page** | No | List AI reviewer publicly |

### Quality Checks

| Setting | Default | Description |
|---------|---------|-------------|
| **Duplicate Detection** | Yes | Flag similar submissions |
| **Similarity Threshold** | 0.7 | How similar before flagging (0.5-0.95) |

### Advanced Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Temperature** | 0.3 | Response variability (0 = consistent, 1 = creative) |
| **Confidence Threshold** | 0.5 | Flag reviews below this confidence |
| **Re-review Cooldown** | 5 min | Wait time before auto re-reviewing edited submissions |
| **Max Response Tokens** | 4096 | Maximum AI response length |
| **Max Input Characters** | 50000 | Maximum submission text size |

### Strictness Levels

| Level | Behavior |
|-------|----------|
| **Lenient** | Encouraging, focuses on potential, lower bar for acceptance |
| **Moderate** | Balanced evaluation of strengths and weaknesses |
| **Strict** | High standards, detailed critique, requires excellence |

---

## How It Works

### Analysis Flow

```
New Submission
      │
      ▼
┌─────────────────┐
│ Fetch Event     │  (criteria, description, audience)
│ Context         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch Speaker   │  (bio, experience, expertise, social profiles)
│ Info            │  NOTE: Email excluded for privacy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Duplicate       │  (if enabled)
│ Detection       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build AI        │  (persona + context + criteria + speaker info)
│ Prompt          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Call AI         │
│ Provider        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Invalid
│ Parse & Validate│─────────────▶ Retry with repair prompt
│ JSON Response   │
└────────┬────────┘
         │ Valid
         ▼
┌─────────────────┐
│ Store Review    │  (in core reviews table)
│ & Display       │
└─────────────────┘
```

### AI Response Structure

The AI returns structured JSON with:

```typescript
{
  criteriaScores: Record<string, number>,  // 1-5 per criterion
  overallScore: number,                     // 1-5
  summary: string,                          // 2-3 sentence summary
  strengths: string[],                      // List of strengths
  weaknesses: string[],                     // List of weaknesses
  suggestions: string[],                    // Actionable suggestions
  recommendation: string,                   // STRONG_ACCEPT to STRONG_REJECT
  confidence: number                        // 0.0 to 1.0
}
```

---

## Speaker Context

### What's Included (v1.13.0+)

The AI receives the following speaker information to better evaluate submissions:

**Primary Speaker:**
- Name
- Position / Company
- Experience Level (First-time, Experienced, Professional, Keynote)
- Expertise Tags
- Bio
- Speaking Experience description
- Social Profiles (LinkedIn, Twitter/X, GitHub, Website)

**Co-Speakers:**
- Name
- Bio

### What's Excluded (Privacy)

- **Email addresses** - Never sent to AI
- **Passwords / Auth data** - Never accessible
- **Private notes** - Only public profile info

### How It Helps

With speaker context, the AI can:
- Better assess speaker credibility for technical topics
- Consider speaking experience when evaluating presentation capability
- Recognize domain expertise that supports the submission content
- Provide more accurate "Speaker Experience" criterion scores

---

## Admin Dashboard

Access via **Admin > Plugins > AI Reviews > Dashboard**

### Overview Stats
- Total reviews completed
- Pending reviews
- Failed reviews
- Average score
- Success rate

### Job Status
- See pending/running AI review jobs
- Monitor processing status

### Recent Reviews
- View latest AI reviews with scores
- Quick links to submissions
- Deduplicated by submission (shows most recent)

### Additional Pages

- **Review History** - Full searchable history with filters
- **Reviewer Personas** - Create custom AI reviewer personas

---

## Privacy & Security

### Data Sent to AI Providers

| Data Type | Sent | Notes |
|-----------|------|-------|
| Submission title | Yes | Required for analysis |
| Abstract | Yes | Required for analysis |
| Outline | Yes | If provided |
| Target audience | Yes | If provided |
| Prerequisites | Yes | If provided |
| Speaker name | Yes | Public info |
| Speaker bio | Yes | Public info |
| Speaker experience | Yes | Public info |
| Social handles | Yes | Public info |
| **Email addresses** | **No** | Explicitly excluded |
| **Passwords** | **No** | Never accessible |

### API Key Security

- API keys are stored encrypted in the database
- Keys are never logged or exposed to the client
- Keys are only used server-side for AI calls

### Service Account

The plugin creates a non-privileged service account to author reviews:
- Cannot log in (no password)
- REVIEWER role (non-privileged)
- Hidden from public team page by default
- Email: `ai-paper-reviewer@plugin.system`

---

## Troubleshooting

### Reviews Not Running

1. Check plugin is **enabled** in Admin > Plugins
2. Verify API key is configured correctly
3. Check **Auto-Review** is enabled (or trigger manually)
4. Look at plugin logs: Admin > Plugins > AI Paper Reviewer > Logs

### Low Scores on All Submissions

1. Check if event review criteria have descriptions
2. Abstracts may lack sufficient detail
3. Try **Lenient** strictness level
4. Verify model is appropriate (try gpt-4o)

### "Speaker Experience" Score is Low

1. Ensure speakers have completed their profiles with:
   - Bio
   - Speaking experience description
   - Experience level selection
   - Expertise tags
2. Co-speakers should have bios added

### Invalid JSON Errors

1. Check plugin logs for raw AI responses
2. Try a different model (gpt-4o is most reliable)
3. Lower temperature to 0.2-0.3
4. Check if max tokens is sufficient

### High Similarity False Positives

1. Increase similarity threshold (e.g., 0.8 instead of 0.7)
2. Review flagged submissions manually
3. Consider disabling if your event has intentionally similar tracks

### API Rate Limits

1. Check provider dashboard for usage
2. Disable auto-review, use manual trigger instead
3. Consider a less expensive model for initial screening
4. Increase re-review cooldown if speakers are editing frequently

---

## Changelog

### v1.13.0
- Added speaker profile context (bio, experience, expertise, social profiles)
- Added co-speaker information
- Privacy: Email addresses excluded from AI context

### v1.12.0
- Security hardening
- Plugin install security acknowledgement

### v1.11.0
- Deduplication of Recent Reviews by submission

### v1.10.x
- Re-review handling improvements
- Unique constraint handling

### v1.9.0
- Admin dashboard improvements
- Review history filtering

### v1.8.0
- Custom reviewer personas

### v1.7.0
- Gemini provider support
- Dynamic model fetching

### Earlier versions
- Core functionality: OpenAI/Anthropic support, auto-review, duplicate detection, confidence thresholds
