# AI Paper Reviewer - Development Roadmap

> **Last Updated:** January 2026
> **Current Version:** 1.13.0

This document outlines the planned development roadmap for the AI Paper Reviewer plugin.

---

## Current State (v1.13.0)

### Core Features
- Multi-provider support (OpenAI, Anthropic Claude, Google Gemini)
- Dynamic model selection from provider
- Event-aware criteria-based scoring
- Speaker profile context (bio, experience, expertise, social profiles)
- Co-speaker information included in reviews
- Configurable strictness levels (Lenient, Moderate, Strict)
- Local duplicate detection within event
- Confidence thresholds with low-confidence flagging
- Custom reviewer personas
- Re-review capability for updated submissions
- Auto-review on new submissions
- Admin dashboard with statistics
- Review history with filtering

### Privacy Features
- Email addresses never sent to AI providers
- Only public profile information shared
- Local duplicate detection (no external calls)

---

## Near-Term Roadmap

### v1.14.0 - Cost Tracking & Transparency

**Goal:** Help organizers understand and manage AI review costs.

| Feature | Description |
|---------|-------------|
| Token usage tracking | Track input/output tokens per review |
| Cost estimation | Calculate estimated cost based on provider pricing |
| Dashboard stats | Display total cost, average cost per review |
| Per-event breakdown | Cost tracking by event |
| Export cost reports | CSV export for budgeting |

**Technical Notes:**
- Store token counts in review metadata
- Provider-specific pricing tables (user-configurable)
- No external API calls required

---

### v1.15.0 - Multi-Language Support

**Goal:** Support non-English submissions and provide reviews in the submission's language.

| Feature | Description |
|---------|-------------|
| Language detection | Auto-detect submission language |
| Native language reviews | Generate review in submission's language |
| Configurable output language | Option to force reviews in specific language |
| Multi-language criteria | Support translated criteria names |

**Technical Notes:**
- Use LLM for language detection (no external API)
- Prompt engineering for language-aware responses
- UI translations out of scope (handled by core platform)

---

### v1.16.0 - LLM-Based Plagiarism Hints

**Goal:** Leverage existing AI to flag potential originality concerns.

| Feature | Description |
|---------|-------------|
| Originality assessment | Ask AI to evaluate content originality |
| Recycled content detection | Flag "conference circuit" talks |
| Self-plagiarism hints | Note if content seems repurposed |
| Confidence indicator | How confident the AI is in its assessment |

**Technical Notes:**
- Added to existing review prompt (no extra API calls)
- Purely advisory - not definitive plagiarism detection
- Clear UI labeling that this is AI opinion, not fact

---

## Mid-Term Roadmap

### v1.20.0 - Enhanced Analytics

| Feature | Description |
|---------|-------------|
| Score distribution charts | Visualize review score patterns |
| Criteria performance | Which criteria score highest/lowest |
| Reviewer persona comparison | Compare scores across personas |
| Trend analysis | Score trends over submission timeline |

---

### v1.25.0 - Batch Operations & Export

| Feature | Description |
|---------|-------------|
| Bulk export reviews | Export all reviews as CSV/PDF |
| Review summaries | Generate executive summary for program committee |
| Comparison reports | Side-by-side submission comparisons |
| Integration hooks | Webhook notifications for review completion |

---

### v1.30.0 - Advanced Duplicate Detection

| Feature | Description |
|---------|-------------|
| Cross-year comparison | Compare against previous years' events |
| Similarity explanations | Explain why submissions are flagged as similar |
| Configurable matching | Tune what constitutes "similar" |
| Speaker history | Track speaker's submission history locally |

---

## Long-Term / Federated Features

### v1.50.0 - Federated Duplicate Detection (Premium)

**Goal:** Cross-network plagiarism and duplicate detection via CFP Directory federation.

| Feature | Description |
|---------|-------------|
| Federated API integration | Secure connection to CFP Directory main |
| Cross-network duplicate check | "Has this been submitted elsewhere?" |
| Anonymized matching | Privacy-preserving similarity detection |
| Speaker reputation hints | Aggregate speaker history across network |
| Conference circuit detection | Flag speakers submitting same talk everywhere |

**Technical Notes:**
- Requires CFP Directory federation infrastructure
- Premium/paid feature for federated network members
- Privacy-first: no raw submission data shared, only similarity hashes
- Self-hosted instances can operate fully without this feature

**Business Model:**
- Free: Full local functionality
- Federated: Access to cross-network intelligence

---

## Considered but Deferred

| Feature | Reason |
|---------|--------|
| External plagiarism APIs (Turnitin, Copyleaks) | Cost, complexity, privacy concerns - may revisit |
| LLM web grounding (Gemini) | Provider-specific, limited value vs complexity |
| Real-time speaker research | Privacy concerns, training data limitations |

---

## Version History

| Version | Release | Highlights |
|---------|---------|------------|
| 1.13.0 | Jan 2026 | Speaker context, co-speaker support, privacy improvements |
| 1.12.0 | Jan 2026 | Security hardening |
| 1.11.0 | Jan 2026 | Recent Reviews deduplication |
| 1.10.x | Jan 2026 | Re-review handling fixes |
| 1.9.0 | - | Admin dashboard improvements |
| 1.8.0 | - | Custom reviewer personas |
| 1.7.0 | - | Gemini support, dynamic models |

---

## Contributing

Feature requests and ideas are welcome. Please open an issue in the [GitHub repository](https://github.com/l33tdawg/cfp-directory-official-plugins/issues) with the `ai-paper-reviewer` and `enhancement` labels.
