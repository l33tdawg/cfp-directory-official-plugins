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
| **Confidence Threshold** | Hide recommendations below this confidence | `0.6` |
| **Low Confidence Behavior** | Hide, Warn, or Require Override | `warn` |
| **Auto-Review** | Automatically review new submissions | `true` |
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

### v1.7.0 (Current)
- Dynamic model fetching - validates API keys and shows real model list from provider
- API key validation at configuration time
- Dashboard shows proper API key configuration status
- Unit tests for dashboard and model fetcher
- Requires cfp-directory-self-hosted v1.13.0+

### v1.6.0
- Service account integration - plugin creates its own reviewer account
- Core review integration - AI reviews stored in main reviews table
- Reviews appear in standard submissions list with scores
- Added "Show on Team Page" visibility option
- Requires cfp-directory-self-hosted v1.12.0+

### v1.5.0
- Admin dashboard with review stats and bulk actions
- Review queue for unreviewed submissions
- Improved tab styling and UI polish
- Updated Anthropic models to Claude 4 series

### v1.4.0
- Admin pages for Review History and Reviewer Personas
- Sidebar navigation for plugin admin pages
- Persona presets (Technical Expert, Business Analyst, etc.)

### v1.1.0
- Event-aware review criteria with weighted scoring
- Google Gemini provider support
- Duplicate/similar submission detection
- Confidence thresholds with configurable behavior
- JSON response repair with AI-assisted retry
- Configurable strictness levels and review focus
- Custom persona support

### v1.0.0
- Initial release with OpenAI and Anthropic support
- Basic submission analysis with fixed criteria
- Auto-review on submission creation

## License

Apache License 2.0
