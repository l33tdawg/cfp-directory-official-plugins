# AI Paper Reviewer Plugin

> **Current App Version:** 1.0.0  
> **Plugin Target Version:** 1.0.0  
> **Requires:** Plugin System v1.4.0+  
> **Status:** In Development  
> **Repository:** `cfp-directory-plugins` (separate from main app)

This document describes the AI Paper Reviewer plugin, which automatically analyzes CFP submissions using AI to provide preliminary review scores, research insights, and feedback based on the event's configured review criteria.

## Table of Contents

- [Overview](#overview)
- [Plugin Distribution](#plugin-distribution)
- [Features](#features)
- [Configuration](#configuration)
- [AI Reviewer Persona](#ai-reviewer-persona)
- [Research Capabilities](#research-capabilities)
- [Human-in-the-Loop Safeguards](#human-in-the-loop-safeguards)
- [Architecture](#architecture)
- [UI Components](#ui-components)
- [Implementation Plan](#implementation-plan)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

---

## Overview

The AI Paper Reviewer plugin acts as an automated program committee member, providing intelligent analysis of talk submissions. Unlike simple scoring systems, it:

- **Uses the event's configured review criteria** - Scores align with what human reviewers evaluate
- **Has a defined persona** - Acts as an experienced conference reviewer with configurable strictness
- **Performs research** - Checks for duplicate/similar talks and researches speaker background
- **Provides confidence levels** - Knows when it's uncertain and flags low-confidence results
- **Respects human judgment** - Assists reviewers rather than replacing them

### Why a Plugin?

Rather than building AI review into the core application:

| Concern | Plugin Approach |
|---------|-----------------|
| **Cost** | Only organizations that want AI review pay for API calls |
| **Privacy** | Some orgs may not want submissions sent to external AI |
| **Provider Choice** | Users can pick OpenAI, Anthropic, Google, or future providers |
| **Modularity** | Can be disabled/removed without affecting core functionality |
| **Updates** | Plugin updates independently of the main application |

---

## Plugin Distribution

The AI Paper Reviewer plugin lives in a **separate GitHub repository** (`cfp-directory-plugins`), not bundled with the main CFP Directory application.

### Installation Methods

**1. One-Click Install (Official Plugins)**

From Admin > Plugins > Available Plugins:
- Browse official plugins from the registry
- Click "Install" to automatically download and set up
- Configure settings and enable

**2. Manual Upload (Third-Party Plugins)**

From Admin > Plugins > Upload Plugin:
- Download plugin zip from any source
- Upload via the admin interface
- Review permissions and enable

### Update Notifications

The system automatically checks for plugin updates and shows notifications in the admin interface when newer versions are available.

### Repository Structure

```
cfp-directory-plugins/
├── registry.json                 # Plugin registry manifest
├── plugins/
│   ├── ai-paper-reviewer/
│   │   ├── manifest.json
│   │   ├── index.ts
│   │   ├── lib/
│   │   │   ├── prompts.ts        # AI persona & prompt templates
│   │   │   ├── schema.ts         # JSON validation
│   │   │   ├── research.ts       # Duplicate/speaker research
│   │   │   └── providers/
│   │   │       ├── openai.ts
│   │   │       ├── anthropic.ts
│   │   │       └── gemini.ts
│   │   └── components/
│   │       ├── ai-review-panel.tsx
│   │       └── low-confidence-card.tsx
│   └── (other-plugins)/
└── .github/workflows/
    └── release.yml               # Auto-build releases
```

---

## Features

### v1.0.0 (Current Release)

- **Multi-provider support**: OpenAI, Anthropic, Google Gemini
- **Event-aware criteria**: Uses the event's configured review criteria and weights
- **Configurable strictness**: Lenient, Moderate, or Strict review standards
- **AI persona**: Consistent, professional reviewer behavior
- **Duplicate detection**: Identifies similar submissions within the event
- **Speaker research**: Optional background research on speakers
- **Confidence thresholds**: Hide unreliable recommendations
- **Admin override**: Show hidden results when needed
- **JSON validation with retry**: Robust response parsing
- **Audit trail**: Raw responses stored for debugging

### v1.1.0 (Planned)

- Manual re-analysis trigger button
- Custom prompt templates
- Cost tracking per submission
- Batch analysis for existing submissions

### v1.2.0 (Planned)

- Side-by-side human vs AI comparison
- AI agreement scoring (how often AI matches human reviewers)
- Export AI analysis data
- Cross-reference with past events

---

## Configuration

### Full Configuration Schema

```json
{
  "name": "ai-paper-reviewer",
  "displayName": "AI Paper Reviewer",
  "version": "1.0.0",
  "apiVersion": "1.0",
  "description": "Intelligent submission analysis with research capabilities",
  "author": "CFP Directory",
  "permissions": ["submissions:read", "reviews:write", "events:read"],
  "configSchema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "title": "AI Provider",
        "enum": ["openai", "anthropic", "gemini"],
        "default": "openai"
      },
      "apiKey": {
        "type": "string",
        "title": "API Key",
        "description": "API key for your chosen provider",
        "format": "password"
      },
      "model": {
        "type": "string",
        "title": "Model",
        "description": "AI model to use (options depend on provider)"
      },
      "temperature": {
        "type": "number",
        "title": "Temperature",
        "description": "0.0 = consistent, 1.0 = creative",
        "default": 0.3,
        "minimum": 0,
        "maximum": 1
      },
      "maxTokens": {
        "type": "number",
        "title": "Max Tokens",
        "default": 2000,
        "minimum": 500,
        "maximum": 8000
      },
      "useEventCriteria": {
        "type": "boolean",
        "title": "Use Event Review Criteria",
        "description": "When enabled, uses the event's configured review criteria",
        "default": true
      },
      "strictnessLevel": {
        "type": "string",
        "title": "Review Strictness",
        "enum": ["lenient", "moderate", "strict"],
        "default": "moderate"
      },
      "reviewFocus": {
        "type": "array",
        "title": "Review Focus Areas",
        "items": { "type": "string" },
        "default": ["constructive", "balanced"]
      },
      "customPersona": {
        "type": "string",
        "title": "Custom Persona (Optional)",
        "description": "Additional persona instructions for the AI reviewer",
        "format": "textarea"
      },
      "enableDuplicateDetection": {
        "type": "boolean",
        "title": "Duplicate Detection",
        "description": "Check for similar submissions in the same event",
        "default": true
      },
      "duplicateThreshold": {
        "type": "number",
        "title": "Similarity Threshold",
        "description": "Flag submissions above this similarity (0.0-1.0)",
        "default": 0.7,
        "minimum": 0.5,
        "maximum": 0.95
      },
      "enableSpeakerResearch": {
        "type": "boolean",
        "title": "Speaker Research",
        "description": "Research speaker background (requires additional API)",
        "default": false
      },
      "confidenceThreshold": {
        "type": "number",
        "title": "Confidence Threshold",
        "description": "Hide recommendations below this confidence",
        "default": 0.6,
        "minimum": 0,
        "maximum": 1
      },
      "lowConfidenceBehavior": {
        "type": "string",
        "title": "Low Confidence Behavior",
        "enum": ["hide", "warn", "require_override"],
        "default": "warn"
      },
      "autoReview": {
        "type": "boolean",
        "title": "Auto-Review New Submissions",
        "default": true
      }
    },
    "required": ["apiKey"]
  }
}
```

### Model Options by Provider

| Provider | Available Models |
|----------|------------------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| **Anthropic** | claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229 |
| **Google** | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |

### Strictness Levels

| Level | Behavior |
|-------|----------|
| **Lenient** | Encouraging, focuses on potential, lower bar for acceptance |
| **Moderate** | Balanced evaluation of strengths and weaknesses |
| **Strict** | High standards, detailed critique, requires excellence |

---

## AI Reviewer Persona

The AI reviewer has a defined, consistent persona that behaves like an experienced program committee member.

### System Prompt Structure

```
You are an experienced conference paper reviewer serving on the program 
committee for "{event_name}". Your role is to provide fair, constructive, 
and thorough evaluations of talk submissions.

EVENT CONTEXT:
- Event: {event_name}
- Description: {event_description}
- Target Audience: {event_audience}
- Event Type: {event_type}

REVIEW CRITERIA (from event configuration):
{foreach criteria}
- {criteria.name} (weight: {criteria.weight}/5): {criteria.description}
{/foreach}

STRICTNESS LEVEL: {strictness_level}
{strictness_instructions}

{if duplicate_detection}
SIMILAR SUBMISSIONS DETECTED:
{similar_submissions}
Consider whether this submission offers a unique perspective.
{/if}

{if speaker_research}
SPEAKER BACKGROUND:
{speaker_info}
Consider the speaker's experience when evaluating presentation capability.
{/if}

YOUR TASK:
1. Analyze the submission against each review criterion
2. Provide scores (1-5) for each criterion based on event weights
3. Calculate an overall recommendation
4. List specific strengths and weaknesses
5. Provide actionable suggestions for improvement
6. Set your confidence level (0.0-1.0) based on information quality

IMPORTANT GUIDELINES:
- Be objective and fair to all submissions
- Consider the specific event audience
- Acknowledge limitations in your assessment
- Set confidence LOW if:
  - The abstract is vague or lacks detail
  - You're unsure about technical claims
  - The topic is outside typical conference scope
  - Speaker information is insufficient

{custom_persona}
```

### Strictness Instructions

**Lenient:**
```
Be encouraging and supportive. Focus on the submission's potential 
rather than its flaws. Give the benefit of the doubt when information 
is incomplete. Recommend acceptance for submissions that show promise, 
even if they need polish.
```

**Moderate:**
```
Provide a balanced assessment. Acknowledge both strengths and weaknesses 
fairly. Base your recommendation on the overall quality relative to 
typical conference standards. Neither overly harsh nor overly generous.
```

**Strict:**
```
Apply high standards expected of top-tier conferences. Submissions must 
demonstrate clear value, technical accuracy, and excellent presentation. 
Be thorough in identifying issues. Only recommend acceptance for 
submissions that meet excellence criteria.
```

---

## Research Capabilities

### Duplicate/Similar Talk Detection

The AI reviewer can identify submissions that may be duplicates or cover very similar ground.

**How it works:**
1. When a submission is analyzed, existing submissions for the same event are retrieved
2. Text similarity is computed using embeddings or keyword matching
3. Submissions above the threshold (default 70%) are flagged
4. The AI receives this context: "Similar submissions found: [titles]"
5. The AI considers uniqueness in its evaluation

**Configuration:**
```typescript
enableDuplicateDetection: true
duplicateThreshold: 0.7  // 70% similarity
```

**UI Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Similar Submissions Detected                              │
├─────────────────────────────────────────────────────────────┤
│ This submission appears similar to:                         │
│ • "Introduction to Kubernetes" (82% similar)                │
│ • "Container Orchestration 101" (71% similar)               │
│                                                             │
│ Consider whether this offers a unique perspective.          │
└─────────────────────────────────────────────────────────────┘
```

### Speaker Research

Optional feature to research speaker background based on their name.

**How it works:**
1. Extract speaker name from submission or user profile
2. Perform web search for speaker (LinkedIn, GitHub, conference history)
3. Summarize relevant background (talks given, expertise areas)
4. Include in AI context for evaluation

**Privacy Considerations:**
- This feature is **opt-in** and disabled by default
- Only uses publicly available information
- Results are cached to minimize API calls
- Admins should inform speakers that research may be performed

**Configuration:**
```typescript
enableSpeakerResearch: false  // Disabled by default
```

---

## Human-in-the-Loop Safeguards

AI analysis assists reviewers but should never replace human judgment. These safeguards prevent over-reliance on AI.

### Confidence Threshold

The AI provides a confidence score (0.0-1.0) indicating how reliable it believes its assessment is.

**When confidence is low:**
- Abstract is vague or lacks detail
- Technical claims cannot be verified
- Topic is unusual for the event type
- Insufficient information to evaluate

### Low Confidence Behaviors

| Behavior | Description |
|----------|-------------|
| **hide** | Recommendation completely hidden, only scores shown |
| **warn** | Full results shown with prominent warning banner |
| **require_override** | Hidden until admin explicitly approves showing |

### UI States

**Above threshold (normal):**
```
┌─────────────────────────────────────────────────┐
│ 🤖 AI Review          4.2/5    [Accept]         │
├─────────────────────────────────────────────────┤
│ Summary: Strong technical submission with       │
│ clear value proposition...                      │
│                                                 │
│ Confidence: 85%  ████████░░                     │
└─────────────────────────────────────────────────┘
```

**Below threshold (warn mode):**
```
┌─────────────────────────────────────────────────┐
│ 🤖 AI Review          3.5/5    [Neutral]        │
├─────────────────────────────────────────────────┤
│ ⚠️ LOW CONFIDENCE (45%)                          │
│ This assessment may be unreliable. Use as       │
│ supplementary input only.                       │
│                                                 │
│ Summary: The abstract lacks specific details... │
└─────────────────────────────────────────────────┘
```

**Below threshold (hidden mode):**
```
┌─────────────────────────────────────────────────┐
│ 🤖 AI Review          [Low Confidence]          │
├─────────────────────────────────────────────────┤
│ ⚠️ AI recommendation hidden due to low          │
│ confidence (45% < 60% threshold).               │
│                                                 │
│ This prevents potentially unreliable AI         │
│ assessments from influencing decisions.         │
│                                                 │
│ [🔓 Admin: Show Anyway]                         │
└─────────────────────────────────────────────────┘
```

---

## Architecture

### Data Flow

```
┌─────────────────────┐
│  New Submission     │
└──────────┬──────────┘
           │ submission.created hook
           ▼
┌─────────────────────┐
│  Fetch Event Data   │ (criteria, description, audience)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Duplicate Check    │ (if enabled)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Speaker Research   │ (if enabled)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Build AI Prompt    │ (persona + context + criteria)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Call AI Provider   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     Invalid
│  Validate JSON      │─────────────▶ Retry with repair
└──────────┬──────────┘               prompt (max 2x)
           │ Valid
           ▼
┌─────────────────────┐
│  Store Result       │ (with audit trail)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  UI Displays        │ (with confidence check)
└─────────────────────┘
```

### Analysis Result Structure

```typescript
interface AiAnalysisResult {
  // Scores (1-5, matching event criteria)
  criteriaScores: Record<string, number>;
  overallScore: number;
  
  // Feedback
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  
  // Recommendation
  recommendation: 'STRONG_ACCEPT' | 'ACCEPT' | 'NEUTRAL' | 'REJECT' | 'STRONG_REJECT';
  confidence: number;  // 0.0 - 1.0
  
  // Research results
  similarSubmissions?: Array<{
    id: string;
    title: string;
    similarity: number;
  }>;
  speakerResearch?: string;
  
  // Audit
  provider: string;
  model: string;
  rawResponse: string;
  parseAttempts: number;
  repairApplied: boolean;
  analyzedAt: string;
}
```

---

## UI Components

### AI Review Panel

Displayed on the submission review page via `submission.review.panel` slot.

```tsx
export function AiReviewPanel({ context, data }: PluginComponentProps) {
  const { submissionId, isAdmin, eventId } = context;
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [showOverridden, setShowOverridden] = useState(false);
  
  // Fetch analysis from completed job
  // Check confidence against threshold
  // Render appropriate state (loading, processing, low-confidence, full)
  
  return (
    <Card>
      <CardHeader>
        <h3>AI Review</h3>
        <RecommendationBadge recommendation={analysis.recommendation} />
        <ConfidenceIndicator value={analysis.confidence} />
      </CardHeader>
      
      {isLowConfidence && !showOverridden ? (
        <LowConfidenceCard onOverride={() => setShowOverridden(true)} />
      ) : (
        <CardContent>
          <Summary text={analysis.summary} />
          <CriteriaScores scores={analysis.criteriaScores} eventCriteria={eventCriteria} />
          <StrengthsList items={analysis.strengths} />
          <WeaknessesList items={analysis.weaknesses} />
          <SuggestionsList items={analysis.suggestions} />
          {analysis.similarSubmissions && (
            <SimilarSubmissionsAlert submissions={analysis.similarSubmissions} />
          )}
          {analysis.speakerResearch && (
            <SpeakerResearchSection content={analysis.speakerResearch} />
          )}
          <Footer provider={analysis.provider} model={analysis.model} timestamp={analysis.analyzedAt} />
        </CardContent>
      )}
    </Card>
  );
}
```

### Configuration UI (Admin)

The plugin configuration form in Admin > Plugins supports:

- **Provider Section**: Provider dropdown, API key, model selection, temperature slider
- **Criteria Section**: Toggle for event criteria, manual override options
- **Strictness Section**: Strictness level selector, review focus checkboxes
- **Research Section**: Duplicate detection toggle with threshold, speaker research toggle
- **Safeguards Section**: Confidence threshold, low-confidence behavior selector
- **Automation Section**: Auto-review toggle

---

## Implementation Plan

### Phase 1: Enhanced Configuration
- Update manifest with full config schema
- Implement provider-specific model lists
- Add temperature and strictness settings
- Support event criteria integration

### Phase 2: AI Persona & Prompts
- Create `lib/prompts.ts` with template system
- Implement strictness level prompts
- Add custom persona support
- Build dynamic prompt from event context

### Phase 3: Research Features
- Implement duplicate detection with embeddings
- Add speaker research capability (optional)
- Include research context in AI prompts
- Display research results in UI

### Phase 4: Human-in-the-Loop
- Implement confidence threshold logic
- Add low-confidence UI states
- Build admin override functionality
- JSON validation with retry

### Phase 5: Google Gemini Support
- Add Gemini provider in `lib/providers/gemini.ts`
- Test with Gemini models
- Update model selection UI

### Phase 6: UI Polish
- Enhanced review panel with all features
- Re-analyze button
- Confidence indicators
- Research results display
- Stats dashboard improvements

---

## API Endpoints

The plugin adds these API routes (via plugin route system):

```
GET  /api/plugins/ai-paper-reviewer/analysis/:submissionId
     Returns AI analysis for a submission

POST /api/plugins/ai-paper-reviewer/analyze/:submissionId
     Manually trigger analysis for a submission

GET  /api/plugins/ai-paper-reviewer/stats
     Returns aggregate statistics for the event

GET  /api/plugins/ai-paper-reviewer/similar/:submissionId
     Returns similar submissions (duplicate detection)
```

---

## Troubleshooting

### Analysis not running

1. Check plugin is enabled in Admin > Plugins
2. Verify API key is configured correctly
3. Check `autoReview` is enabled
4. Look at plugin logs (Admin > Plugins > [plugin] > Logs)

### Invalid JSON errors

1. Check plugin logs for raw AI responses
2. May indicate prompt issues with specific model
3. Try a different model (e.g., gpt-4o instead of gpt-3.5-turbo)
4. Check if temperature is too high (try 0.2-0.3)

### Low confidence on all submissions

1. Event review criteria may be too vague - add descriptions
2. Abstracts may lack sufficient detail
3. Consider lowering confidence threshold temporarily
4. Check if model is appropriate for your domain

### High similarity false positives

1. Lower the duplicate threshold (e.g., 0.8 instead of 0.7)
2. Review flagged submissions manually
3. Consider disabling if your event has intentionally similar tracks

### API rate limits

1. Check provider dashboard for usage
2. Disable auto-review, use manual trigger instead
3. Consider a less expensive model for initial screening
4. Add delays between submissions if bulk-importing

### Speaker research not working

1. Verify the feature is enabled
2. Check if web search API key is configured
3. Some speakers may have limited public presence
4. Results are cached - wait for cache expiry or clear manually
