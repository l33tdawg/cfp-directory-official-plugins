# AI Paper Reviewer Plugin

Automatically analyzes paper/talk submissions using AI to provide preliminary reviews with scoring, feedback, and recommendations.

## Features

- **Multi-provider support** - OpenAI, Anthropic (Claude), and Google Gemini
- **Event-aware criteria** - Uses the event's configured review criteria and weights
- **Configurable strictness** - Lenient, Moderate, or Strict review standards
- **Duplicate detection** - Identifies similar submissions within the same event
- **Confidence thresholds** - Hide unreliable AI recommendations automatically
- **JSON repair** - Robust response parsing with automatic retry
- **Admin override** - Show hidden low-confidence results when needed

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

### Model Options by Provider

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| **Anthropic** | claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229 |
| **Google** | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |

## How It Works

1. A new submission is created (or updated with content changes)
2. The plugin fetches event review criteria and checks for duplicate submissions
3. A dynamic prompt is built using event context, criteria, strictness level, and any similar submissions found
4. The AI provider analyzes the submission and returns structured JSON
5. Results are parsed (with automatic repair if JSON is malformed)
6. The AI Review panel displays scores, strengths, weaknesses, and recommendations
7. Low-confidence results are handled according to the configured behavior

## Hooks

| Hook | Trigger |
|------|---------|
| `submission.created` | Queues AI review for new submissions (if auto-review is enabled) |
| `submission.updated` | Queues re-review when title, abstract, or outline changes |

## UI Components

- **AI Review Panel** (`submission.review.panel` slot) - Displays AI analysis results with confidence indicator, criteria scores, strengths/weaknesses, suggestions, and similar submission alerts

## Permissions Required

- `submissions:read` - Read submission content for analysis
- `reviews:write` - Store AI review results
- `events:read` - Fetch event criteria and context

## File Structure

```
ai-paper-reviewer/
├── manifest.json              # Plugin metadata and config schema
├── index.ts                   # Plugin entry point, hooks, and job handler
├── components/
│   └── ai-review-panel.tsx    # Review panel UI component
└── lib/
    ├── prompts.ts             # Dynamic prompt construction
    ├── providers.ts           # OpenAI, Anthropic, Gemini API abstraction
    ├── json-repair.ts         # JSON parse retry with AI-assisted repair
    └── similarity.ts          # Jaccard similarity for duplicate detection
```

## Version History

### v1.1.0 (Current)
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

MIT
