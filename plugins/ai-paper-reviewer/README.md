# AI Paper Reviewer Plugin

Automatically analyzes paper/talk submissions using AI to provide preliminary reviews with scoring, feedback, and recommendations. Reviews are stored in the core reviews table alongside human reviews.

## Features

- **Multi-provider support** - OpenAI, Anthropic (Claude), and Google Gemini
- **Google Search grounding** - Gemini can fact-check recent events, vulnerabilities, and claims using Google Search (recommended)
- **Core review integration** - AI reviews appear in the standard submissions list with scores
- **Service account** - Plugin creates its own reviewer account (hidden from public by default)
- **Event-aware criteria** - Uses the event's configured review criteria and weights
- **Configurable strictness** - Lenient, Moderate, or Strict review standards
- **Duplicate detection** - Identifies similar submissions within the same event
- **Confidence thresholds** - Hide unreliable AI recommendations automatically
- **JSON repair** - Robust response parsing with automatic retry
- **Admin dashboard** - Review stats, job queue status, and bulk review actions
- **Cost tracking** - Monitor API spending with budget limits and alerts
- **Speaker context** - AI considers speaker profile, experience, and past talks
- **Re-review capability** - Trigger new reviews for updated submissions
- **Expandable details** - Collapsible review sections for cleaner UI

## Installation

### One-Click Install (Recommended)

1. Go to **Admin > Plugins > Available Plugins** in your CFP Directory instance
2. Find "AI Paper Reviewer" and click **Install**
3. Configure your API key and preferences
4. Enable the plugin

### Manual Install

1. Download the latest release zip from [Releases](https://github.com/l33tdawg/cfp-directory-official-plugins/releases)
2. Go to **Admin > Plugins > Upload Plugin**
3. Upload the zip file
4. Configure and enable

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **AI Provider** | Gemini (recommended), OpenAI, or Anthropic | `gemini` |
| **API Key** | API key for your chosen provider | *(required)* |
| **Model** | AI model to use | `gemini-2.0-flash` |
| **Enable Web Search** | Allow Gemini to search the web for fact-checking (Gemini only) | `true` |
| **Temperature** | 0.0 = consistent, 1.0 = creative | `0.3` |
| **Max Tokens** | Maximum tokens for AI response | `2000` |
| **Use Event Criteria** | Use the event's review criteria and weights | `true` |
| **Review Strictness** | Lenient, Moderate, or Strict | `moderate` |
| **Duplicate Detection** | Check for similar submissions | `true` |
| **Similarity Threshold** | Flag submissions above this similarity | `0.7` |
| **Confidence Threshold** | Hide recommendations below this confidence | `0.5` |
| **Auto-Review** | Automatically review new submissions | `true` |
| **Monthly Budget Limit** | Maximum monthly spend in USD (0 = unlimited) | `0` |
| **Budget Alert Threshold** | Show warning at this % of budget | `80` |
| **Pause on Budget Exceeded** | Stop auto-reviews when budget is reached | `true` |
| **Re-review Cooldown** | Minimum wait between re-reviews (minutes) | `5` |
| **Show on Team Page** | Display AI reviewer on public team page | `false` |

### Model Options by Provider

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o (recommended), gpt-4o-mini |
| **Anthropic** | claude-sonnet-4-20250514 (recommended), claude-haiku-4-20250514 |
| **Google** | gemini-2.0-flash (recommended), gemini-2.5-pro |

## How It Works

1. When enabled, the plugin creates a service account (`ai-paper-reviewer@plugin.system`)
2. A new submission is created (or updated with content changes)
3. The plugin fetches event review criteria and checks for duplicate submissions
4. A dynamic prompt is built using event context, criteria, strictness level, and any similar submissions found
5. The AI provider analyzes the submission and returns structured JSON
6. Results are parsed (with automatic repair if JSON is malformed)
7. A review is created in the core reviews table using the service account
8. The AI Review panel displays additional details (strengths, weaknesses, suggestions)
9. Low-confidence results are handled according to the configured behavior

## Service Account

The plugin creates a non-privileged service account:
- **Email**: `ai-paper-reviewer@plugin.system`
- **Role**: REVIEWER (cannot access admin functions)
- **Login**: Disabled (no password, unverified email)
- **Public visibility**: Hidden from team page by default

This allows AI reviews to appear alongside human reviews in the standard submissions list while maintaining security.

## Admin Pages

Access via **Admin > Plugins > AI Reviews**:

- **Dashboard** - Review stats, job queue status, submission review queue, bulk actions
- **History** - Complete history of AI reviews with scores and recommendations
- **Personas** - Configure reviewer persona presets (Technical Expert, Business Analyst, etc.)
- **Settings** - Full plugin configuration (provider, API key, model, budget, advanced options)

## Hooks

| Hook | Trigger |
|------|---------|
| `submission.created` | Queues AI review for new submissions (if auto-review is enabled) |
| `submission.updated` | Queues re-review when title, abstract, or outline changes (respects cooldown) |

## Actions

| Action | Description |
|--------|-------------|
| `list-models` | Fetches available models from the configured AI provider |
| `clear-reviews` | Deletes all AI-generated reviews (for testing/reset) |
| `delete-review` | Deletes a specific AI-generated review |
| `reset-budget` | Resets the monthly spending counter to zero |
| `get-cost-stats` | Returns current spending, budget status, and cost breakdown |
| `save-settings` | Saves plugin configuration to plugin data store |
| `get-settings` | Returns current plugin configuration (API key masked) |

## UI Components

- **AI Review Panel** (`submission.review.panel` slot) - Displays AI analysis results with confidence indicator, criteria scores, strengths/weaknesses, suggestions, and similar submission alerts

## Permissions Required

- `submissions:read` - Read submission content for analysis
- `reviews:write` - Create AI review records
- `reviews:read` - Check for existing reviews
- `events:read` - Fetch event criteria and context
- `users:manage` - Create the service account

## File Structure

```
ai-paper-reviewer/
├── manifest.json              # Plugin metadata (no configSchema — plugin manages its own settings)
├── index.ts                   # Plugin entry point, hooks, actions, and job handler
├── components/
│   ├── ai-review-panel.tsx    # Review panel UI component
│   ├── admin-sidebar-item.tsx # Sidebar navigation component
│   ├── admin-dashboard.tsx    # Admin dashboard page
│   ├── admin-review-history.tsx # Review history page
│   ├── admin-personas.tsx     # Persona configuration page
│   ├── admin-settings.tsx     # Settings configuration page
│   └── admin-onboarding.tsx   # First-run setup wizard
├── lib/
│   ├── config.ts              # Plugin config access and migration helpers
│   ├── prompts.ts             # Dynamic prompt construction
│   ├── providers.ts           # OpenAI, Anthropic, Gemini API abstraction
│   ├── json-repair.ts         # JSON parse retry with AI-assisted repair
│   ├── model-fetcher.ts       # Dynamic model list fetching from providers
│   └── similarity.ts          # Jaccard similarity for duplicate detection
└── dist/                      # Pre-compiled admin bundles (generated)
    ├── admin-pages.js
    ├── admin-pages.js.map
    └── admin-pages.manifest.json
```

## Version History

### v1.34.0 (Current)
- **Always-visible Jobs in Progress** - The in-progress section now always shows on the dashboard with an empty state message when no jobs are active, instead of disappearing
- **Retrying job status** - Jobs with multiple attempts now display a distinct "Retrying" badge with orange styling instead of the normal "Analyzing" badge
- **Smooth slide-in animation** - Newly completed reviews slide in with a fade+translate animation instead of appearing abruptly on poll updates
- **Extended polling after completion** - Dashboard continues polling for 15 seconds after the last job completes to ensure the final review state is captured and animated

### v1.33.0
- **Auto-refresh reviews section** - Completed reviews now appear automatically in the Recent Reviews section without requiring a manual page refresh
- **Fix: Job queue stats for failed jobs** - Failed job counts now correctly displayed using fallback date fields (failedAt, updatedAt) when completedAt is not set
- **Fix: Provider/model display** - Dashboard now shows actual configured provider (e.g. Gemini) instead of incorrect defaults
- **Smart transition detection** - When active jobs complete, submissions and cost stats are automatically refreshed

### v1.32.0
- Initial auto-refresh and job stats fixes (superseded by v1.33.0)

### v1.31.0
- **Dashboard layout improvements** - Recent Reviews section now appears above Review Queue for better visibility
- **Collapsible sections** - Both Recent Reviews and Review Queue sections can be collapsed/expanded by clicking the header
- **Recent Reviews pagination** - Reviews are now paginated (10 per page) instead of limited to 10 total
- **Fix: Job handler payload extraction** - Correctly handle both full Job objects and direct payloads from the platform job processor

### v1.30.0
- **Plugin-owned settings** - Configuration moved from platform-managed `configSchema` to plugin-owned data store via `save-settings` / `get-settings` actions
- **Settings admin page** - Full settings UI with grouped sections: Provider, Review Style, Automation, Budget, Quality Checks, Advanced
- **Config migration** - Existing deployments seamlessly migrate from platform config to plugin data on enable (one-time, automatic)
- **Encrypted API key storage** - API keys stored encrypted in plugin data, masked in client responses
- **Onboarding wizard** - First-run setup wizard guides new installations through provider selection, API key entry, and model configuration

### v1.29.0
- **Fix: Admin pages now bundled in manifest** - Dashboard, Review History, and Personas pages now properly declared in manifest.json for platform discovery
- **Fix: Dynamic model loading in configuration** - Model selector now properly passes API key to fetch models dynamically from provider (up to 10 models)
- **Fix: Admin page path mismatch** - Dashboard path aligned with sidebar navigation

### v1.28.0
- Standardized version tagging to `v<version>` format
- Updated README with current version

### v1.27.0
- Configuration UI improvements
- Bug fixes and stability improvements

### v1.26.0
- **Bug fix: Include full talk description in AI review**
  - AI now sees the "Full Talk Description" content (was missing)
  - Better context for comprehensive reviews

### v1.25.0
- **Google Search grounding for fact-checking (Gemini)**
  - Verify claims about recent events, security vulnerabilities, tools
  - No extra API keys needed - works with existing Gemini API key
  - Configurable via "Enable Web Search" setting
- **Gemini now default/recommended provider**
  - Onboarding wizard shows "Recommended" badge
  - Default model: gemini-2.0-flash
- Added comprehensive provider tests

### v1.24.0
- Reduced verbose logging (DEBUG level for most logs)
- Dashboard stats fixes

### v1.14.1
- Fix: TypeScript type annotation for filter callback
- Fix: Release package now includes pre-built admin bundle

### v1.14.0
- **Cost tracking and budget management**
  - Track API spending per review with token counts
  - Set monthly budget limits with automatic pause
  - Budget alert thresholds with dashboard warnings
  - Reset budget action for new billing periods
  - Cost statistics in dashboard header

### v1.13.0
- **Speaker context in AI reviews**
  - AI considers speaker profile, bio, and experience level
  - Past speaking history and expertise tags included
  - Social profiles (LinkedIn, Twitter, GitHub) for context
  - Co-speaker information included in analysis

### v1.12.0
- **Security hardening**
  - Resource exhaustion protections (input limits, rate limiting)
  - Secure API key handling (server-side only)
  - Input validation and sanitization

### v1.11.0
- **Comprehensive security review**
  - XSS prevention in all user-facing content
  - Safe JSON parsing with size limits
  - Audit logging for sensitive operations

### v1.10.x
- Expandable review details with re-review capability
- Criteria scores displayed in table format at top
- Deduplicated Recent Reviews section
- Handle unique constraint on re-review gracefully
- Removed public notes (admins decide what feedback to share)

### v1.9.0
- Re-review submissions with updated content
- Clear review history action
- More robust JSON response parsing

### v1.7.1
- Dashboard "Jobs in Progress" section shows pending/running jobs
- Auto-refresh when jobs are active (every 5 seconds)
- Fix: Model fetching now uses form's current API key

### v1.7.0
- Dynamic model fetching from provider APIs
- API key validation at configuration time
- Dashboard shows API key configuration status

### v1.6.0
- Service account integration - plugin creates its own reviewer account
- Core review integration - AI reviews stored in main reviews table
- Reviews appear in standard submissions list with scores
- Added "Show on Team Page" visibility option

### v1.5.0
- Admin dashboard with review stats and bulk actions
- Review queue for unreviewed submissions
- Updated Anthropic models to Claude 4 series

### v1.4.0
- Admin pages for Review History and Reviewer Personas
- Sidebar navigation for plugin admin pages

### v1.1.0
- Event-aware review criteria with weighted scoring
- Google Gemini provider support
- Duplicate/similar submission detection
- Confidence thresholds and JSON repair

### v1.0.0
- Initial release with OpenAI and Anthropic support
- Basic submission analysis with auto-review

## License

Apache License 2.0
