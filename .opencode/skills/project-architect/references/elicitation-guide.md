# Elicitation Guide

Interactive discovery process for understanding a project before generating documentation.
Use `AskUserQuestion` tool for structured choices; reserve freeform for open-ended questions.

## Core Strategy

1. **Extract before asking.** Scan everything the user already said. Don't re-ask answered questions.
2. **Tap, don't type.** Use `AskUserQuestion` for any question with 2-4 clear options.
3. **Batch related questions.** Group 1-3 related questions per interaction, never 5+.
4. **Adapt depth to ambition.** Weekend hack = 5-8 questions. Full product = 15-25 questions.
5. **Stop when you have enough.** Not every question needs answering. Move on when you can
   generate a useful specification.

## Question Tiers

**Tier 1 — Blockers** (always ask if unanswered):
Cannot generate SPECIFICATION.md without these.

**Tier 2 — Important** (ask for medium+ projects):
Significantly improve document quality.

**Tier 3 — Depth** (ask for large projects or engaged users):
Add thoroughness and prevent design mistakes.

## Discovery Flow

### Step 1: Project Identity (Tier 1 — always ask)

**Freeform:**
"Describe what you want to build in a few sentences — the problem it solves and who it's for."

**Then ask structured choices:**

- What type of project is this? (Web Application / CLI Tool / API Service / Mobile/Desktop)
- What's the scope? (MVP / Proof of Concept / Full Product v1.0 / Enterprise-grade)

### Step 2: Technical Direction (Tier 1)

- Do you have a programming language preference? (Yes / Help me choose / No preference)
- If "Help me choose" → run the stack advisor flow from tech-stacks.md
- Where will this run? (Cloud/SaaS / Self-hosted / Local only / Hybrid)

### Step 3: Data & Storage (Tier 1-2)

- Does this project need a database? (Yes, relational / Yes, document / Help me choose / No)
- If choosing: what best describes your data? (Structured with relationships / Flexible documents / Time-series / Key-value)

### Step 4: Features & Scope (Tier 1-2)

- What are the 3-5 core features?
- Does this need user authentication? (Full auth / API keys only / No auth / Undecided)
- Does this need a user interface? (Web UI / CLI / Desktop / API only)

### Step 5: Architecture Preferences (Tier 2)

- How do you think about external dependencies? (Ecosystem standard / Fewer, well-chosen / Minimal / No preference)
- Does this need real-time capabilities? (Yes / No / Maybe later)
- API style preference? (REST / GraphQL / gRPC / Multiple / Help me choose / No API)

### Step 6: Operations & Deployment (Tier 2)

- How will users get this software? (Docker / Single binary / Package manager / Cloud-hosted / Not decided)
- Do you need CI/CD from day one? (Yes, full pipeline / Basic / Not yet)

### Step 7: Scale & Performance (Tier 2-3)

- Expected scale at launch? (Personal/small team / Medium / Large / Massive / Unknown)

### Step 8: Project Meta (Tier 2-3)

- Will this be open source? (Fully open / Open-core / Proprietary / Undecided)
- Team size? (Solo / Small team 2-5 / Larger team 5+)

## Adaptive Questioning Matrix

| User Signal | Questions to Ask | Depth |
|-------------|-----------------|-------|
| "I want to build X" (1 line) | Steps 1-5 fully, 6-8 selectively | High |
| Detailed 3+ paragraph brief | Gaps in Steps 1-3 only | Low |
| "Help me with everything" | All steps, all tiers | Maximum |
| "Just need a quick spec" | Step 1-2 only, sensible defaults | Minimal |
| Uploads existing doc | Extract all answers, ask only gaps | Varies |

## After Discovery

Once you have sufficient answers, summarize before generating:

"Here's what I understand:
- **Project**: [name/description]
- **Type**: [web app / CLI / etc.]
- **Stack**: [language + framework + database]
- **Key Features**: [bulleted list]
- **Deployment**: [how/where]
- **Scope**: [MVP / full]

Does this look right? I'll start with the SPECIFICATION.md."

Wait for confirmation before generating any document.
