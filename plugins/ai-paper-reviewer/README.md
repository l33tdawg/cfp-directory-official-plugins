# AI Paper Reviewer Plugin

Automatically analyzes paper/talk submissions using AI to provide preliminary reviews with scoring, feedback, and recommendations. Reviews are stored in the core reviews table alongside human reviews.

## Features

- **Multi-provider support** - OpenAI, Anthropic (Claude), and Google Gemini
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
| **AI Provider** | OpenAI, Anthropic, or Gemini | `openai` |
| **API Key** | API key for your chosen provider | *(required)* |
| **Model** | AI model to use | `gpt-4o` |
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
├── manifest.json              # Plugin metadata and config schema
├── index.ts                   # Plugin entry point, hooks, and job handler
├── components/
│   ├── ai-review-panel.tsx    # Review panel UI component
│   ├── admin-sidebar-item.tsx # Sidebar navigation component
│   ├── admin-dashboard.tsx    # Admin dashboard page
│   ├── admin-review-history.tsx # Review history page
│   └── admin-personas.tsx     # Persona configuration page
├── lib/
│   ├── prompts.ts             # Dynamic prompt construction
│   ├── providers.ts           # OpenAI, Anthropic, Gemini API abstraction
│   ├── json-repair.ts         # JSON parse retry with AI-assisted repair
│   └── similarity.ts          # Jaccard similarity for duplicate detection
└── dist/                      # Pre-compiled admin bundles (generated)
    ├── admin-pages.js
    ├── admin-pages.js.map
    └── admin-pages.manifest.json
```

## Version History

### v1.14.1 (Current)
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
