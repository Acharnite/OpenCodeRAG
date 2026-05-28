# Coding Agent Prompt Guide

How to write PROMPT.md — a **single-shot prompt** that a coding agent can execute to build the
entire project from scratch. This is the most important output of the Project Architect skill.

## What Makes a Great Coding Agent Prompt

A great prompt eliminates all ambiguity. The agent should never have to guess, infer,
or make creative decisions. Every file, every dependency, every pattern, every edge case
is spelled out. The prompt IS the source of truth.

## Principles

1. **Self-contained.** The prompt includes everything needed. Inline relevant parts from all docs.
2. **Ordered by build sequence.** Follow the task order from TASKS.md. Foundation first.
3. **Explicit about files.** Name every file to create. Include the path.
4. **Include code for patterns.** For complex patterns, include 10-30 line code sketches.
5. **Specify versions.** Every dependency with exact version number.
6. **Include test expectations.** What tests to write, what they should verify.
7. **One prompt, one project.** The entire project from init to deployable artifact.

## Prompt Structure

```markdown
# [Project Name] — Implementation Prompt

## Project Overview
[3-5 sentences. Elevator pitch + key differentiators. Enough context to understand.]

## Tech Stack
[Table format with exact versions.]

## Project Structure
[Complete directory tree. Every file and directory.]

## Dependencies
[Exact install command with all packages and versions.]

## Configuration Files
[Content for every config file. Exact JSON/YAML/TOML.]

## Implementation Order
Execute these tasks in sequence. Each task builds on the previous.

### Step 1: [Task Title]
**Files:** `path/file.ext`, `path/file.ext`
[What to implement. Reference design patterns. Include code sketches for non-trivial patterns.]
**Tests:** [What to test, expected behavior]

### Step 2: [Task Title]
...

## Data Model
[Complete database schema, ready to copy into migration.]

## API Reference
[Route table with method, path, handler, auth, description.]
[Standard response and error formats.]

## Error Handling
[Error classification table.]

## Environment Variables
[Table with variable name, required, default, description.]

## Testing Requirements
- Unit tests for all service/business logic
- Integration tests for all API endpoints
- Test database setup/teardown between suites

## Quality Checks
- [ ] Lint passes
- [ ] Tests pass
- [ ] Build produces production artifact
- [ ] All API endpoints respond correctly
- [ ] Database migrations run clean
- [ ] Docker build succeeds (if applicable)
```

## Prompt Optimization Rules

### 1. Inline Everything Needed
Don't reference other documents. Inline what the agent needs.

### 2. Code Sketches for Complex Patterns
Include structural code examples for: authentication flow, complex data access patterns,
state machines, middleware chains, plugin systems, event systems. Keep sketches to 10-30 lines.

### 3. Be Explicit About Edge Cases
For each feature, state: invalid input behavior, missing/null handling, duplicate handling,
HTTP status codes for each error case.

### 4. Version Lock Everything
Use exact versions, not ranges.

### 5. Include the Complete Config
Include actual config file content, not descriptions.

### 6. Test-Driven Hints
For each feature, suggest the test FIRST, then implement to make it pass.

### 7. Checkpoint Markers
Include verification points every 3-5 tasks: build should succeed, N tests should pass.

## Prompt Size Guidelines

| Project Size | Prompt Length | Task Count |
|-------------|-------------|-----------|
| Small (weekend hack) | 2,000-5,000 words | 10-20 tasks |
| Medium (side project) | 5,000-15,000 words | 20-50 tasks |
| Large (full product) | 15,000-40,000 words | 50-100+ tasks |
| Enterprise | 40,000+ words (split) | 100+ tasks |

For prompts over 30,000 words, consider splitting into multiple prompts:
- PROMPT-foundation.md (phases 1-2)
- PROMPT-features.md (phases 3-5)
- PROMPT-release.md (phases 6-7)
