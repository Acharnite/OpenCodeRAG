# Tasks Guide

How to write TASKS.md — ordered, actionable work items that a developer or coding agent
can execute sequentially to build the entire project.

## Principles

1. **Each task is a single agent session.** Self-contained context, clear deliverables.
2. **Dependency order is the build order.** No task references work from a later task.
3. **2-8 hours per task.** Smaller → merge. Larger → split.
4. **Every task names its files.** List exactly which files to create or modify.
5. **Acceptance criteria are tests.** Each criterion should be machine-verifiable.
6. **Front-load foundation.** Setup, types, data layer first. Features after.

## Template

```markdown
# [Project Name] — Tasks

## Summary
| Metric | Value |
|--------|-------|
| Total Tasks | [N] |
| Phases | [N] |
| Estimated Effort | [X-Y hours/days] |
| MVP Complete | After Task [N] |

## Phase 1: Project Foundation
> After this phase: project compiles/runs, nothing functional yet.

### Task 1: Project Scaffolding
**Create the project skeleton with all config files and directory structure.**

**Files to create:**
- `package.json` / `go.mod` — with all dependencies
- `.gitignore` — language-appropriate
- `tsconfig.json` / equivalent — strict mode
- Linting/formatter config
- Dev/build/test/lint commands
- `docker-compose.yml` — dev environment
- All directories from IMPLEMENTATION.md §3.1

**Acceptance Criteria:**
- [ ] Build completes without errors
- [ ] Lint passes
- [ ] Test command runs (0 tests, 0 failures)
- [ ] All directories exist
- [ ] .gitignore covers build artifacts, env files, dependencies

**Dependencies:** None
**Effort:** 1-2 hours
**Refs:** IMPLEMENTATION.md §1, §3.1

---

### Task 2: Core Domain Types
**Define all domain entities, interfaces, and shared types.**

**Files to create:**
- Domain types (all entities from SPECIFICATION.md §5.1)
- Custom error types (from IMPLEMENTATION.md §7.1)
- Repository/service interfaces

**Acceptance Criteria:**
- [ ] All entity types compile with no generic/wildcard types
- [ ] Repository interfaces cover all operations needed
- [ ] Error types cover all categories
- [ ] Types are exported and importable

**Dependencies:** Task 1
**Effort:** 2-3 hours
**Refs:** SPECIFICATION.md §2, §5; IMPLEMENTATION.md §2, §7

---

### Task N: [Title]
**One-sentence summary.**

**Files to create/modify:**
- `exact/path/file.ext` — purpose
- `exact/path/file.ext` — purpose

**Implementation:**
- Specific implementation details
- Pattern to follow (ref IMPLEMENTATION.md)
- Error handling approach

**Acceptance Criteria:**
- [ ] Specific, verifiable criterion
- [ ] All tests pass

**Dependencies:** Task [N-1]
**Effort:** [X] hours
**Refs:** SPECIFICATION.md §[X]; IMPLEMENTATION.md §[X]

---

## Phase 2: [Phase Name]
...

## Milestones
| Milestone | After Task | What's Achieved | Demo-able? |
|-----------|-----------|-----------------|------------|
| Foundation | Task [N] | Project builds/runs | Smoke test |
| Data Layer | Task [N] | CRUD operations work | API calls |
| Core Features | Task [N] | Primary use cases work | User workflow |
| MVP | Task [N] | Minimum viable product | Full demo |
| Release | Task [N] | Production-ready | Ship it |

## Dependency Graph
[T1] → [T2] → [T3] → [T4]
              ↘
        [T5] → [T6] → [T7]
```

## Phase Structure Guide

### Standard Backend
1. Foundation (scaffolding, types, config)
2. Data Layer (DB setup, migrations, repositories)
3. Core Business Logic (services, use cases)
4. API Layer (handlers, routing, middleware, validation)
5. Auth & Security
6. Testing & Quality
7. Deployment & Docs

### Full-Stack Web App
1. Foundation
2. Backend Core
3. Auth & Security
4. Frontend Foundation
5. Frontend Features
6. Integration
7. Polish & Release

### CLI Tool
1. Foundation
2. Core Logic
3. CLI Interface
4. Advanced Features
5. Distribution

### Library / SDK
1. Foundation
2. Core API
3. Advanced Features
4. Documentation
5. Distribution

## Task Granularity

### Too Small (merge)
- "Create the users table" → merge into "Data Layer Setup"
- "Add email validation" → include in the feature's task

### Right-Sized
- "Data layer: migrations, User + Project repositories, unit tests for CRUD"
- "Auth endpoints: register + login + refresh + logout, JWT, password hashing"

### Too Large (split)
- "Implement the entire API" → split by resource
- "Build the frontend" → split by page/feature

## Acceptance Criteria Rules

Each task needs 3-6 criteria. Each must be: verifiable, specific, machine-testable preferred.

Strong: "POST /api/v1/users with valid data returns 201 with user JSON"
Weak: "It works" / "Code is clean" / "Handles edge cases"

## Coding Agent Optimization

1. **List every file** to create or modify
2. **Include the pattern** to follow (ref IMPLEMENTATION.md)
3. **State the test command**
4. **Reference dependencies** (what's already built)
5. **Keep context self-contained**

## Quality Checklist

- [ ] Task 1 starts from blank project
- [ ] Tasks are in executable order — no forward dependencies
- [ ] Every specification feature appears in at least one task
- [ ] Every implementation module is covered
- [ ] Acceptance criteria are verifiable in every task
- [ ] Files to create/modify are listed in every task
- [ ] Effort estimates total to reasonable timeline
- [ ] Milestones are demo-able
- [ ] Final task produces a releasable artifact
- [ ] No task exceeds 8 hours without subtask breakdown
