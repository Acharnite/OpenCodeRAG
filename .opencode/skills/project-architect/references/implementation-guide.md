# Implementation Guide

How to write IMPLEMENTATION.md — the technical blueprint that translates the specification
into **how** the project will be built. This document makes all architecture decisions,
recommends design patterns, defines concrete structures, and includes code sketches.

**Before generating:** Also read `./references/design-patterns.md` to select patterns.

## Principles

1. **Justify every choice.** Not "use PostgreSQL" — "use PostgreSQL because: relational data, JSONB support, team familiarity."
2. **Be concrete.** Show directory trees, file names, module boundaries, interface signatures.
3. **Recommend patterns with code sketches.** 5-15 line example of how the pattern applies.
4. **Reference the specification.** Every decision traces to a requirement.
5. **Verify versions.** Use web search to confirm latest stable versions.

## Template

```markdown
# [Project Name] — Implementation Plan

## 1. Tech Stack

### 1.1 Stack Summary
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | [lang] | [ver] | [Why specific to this project] |
| Runtime | [runtime] | [ver] | |
| Framework | [fw] | [ver] | [Why this over alternatives] |
| Database | [db] | [ver] | [Match to data model needs] |
| ORM/Data | [orm] | [ver] | |
| Testing | [tool] | [ver] | |
| Linting | [tool] | [ver] | |
| CI/CD | [platform] | — | |

### 1.2 Key Technical Decisions
For each significant decision, use ADR-lite:
- **Context**: What requirement drives this decision (ref SPECIFICATION.md §X)
- **Options Considered**: 2-3 options with pros/cons
- **Choice**: Selected option
- **Rationale**: Why this wins for THIS project
- **Consequences**: Trade-offs accepted, future implications

### 1.3 Dependency Inventory
| Package | Purpose | License | Justification |
|---------|---------|---------|---------------|

## 2. Design Patterns
Consult `./references/design-patterns.md`. For each recommended pattern:
- Pattern name and why it fits
- Code sketch showing pattern applied to project's domain

## 3. Project Structure

### 3.1 Directory Layout
```
[project-name]/
├── src/
│   ├── domain/       # Core domain types and interfaces
│   ├── service/      # Business logic / use cases
│   ├── handler/      # HTTP handlers / controllers
│   ├── repository/   # Data access implementations
│   └── middleware/    # HTTP middleware
├── tests/
├── docs/
├── config files...
```

### 3.2 Module Breakdown
For each module: path, responsibility, exports, imports, key files.

### 3.3 Module Dependency Graph
Show which modules depend on which. Flag concerning coupling.

## 4. Data Layer

### 4.1 Database Schema
Complete schema in project's database syntax. ALL tables/collections, indexes, constraints.

### 4.2 Migration Strategy
Tool, naming convention, rollback approach.

### 4.3 Data Access Pattern
ORM/query builder/raw SQL with rationale and example.

### 4.4 Caching Strategy
What's cached, TTL, invalidation approach.

## 5. API Implementation

### 5.1 Route Structure
| Method | Path | Handler | Middleware | Description |
|--------|------|---------|-----------|-------------|

### 5.2 Request/Response Contract
Standard shapes with examples from project's domain.

### 5.3 Validation Approach
Schema validation library with example.

### 5.4 Authentication Flow
Step-by-step auth implementation.

## 6. Frontend Implementation (if applicable)
Component architecture, state management, routing, styling.

## 7. Error Handling Strategy

### 7.1 Error Classification
| Category | Example | HTTP Code | Logged As | User Sees |
|----------|---------|-----------|-----------|-----------|
| Validation | Bad email | 400 | Debug | Field error |
| Auth | Invalid token | 401 | Info | "Please sign in" |
| Forbidden | No permission | 403 | Warn | "Not authorized" |
| Not Found | Missing resource | 404 | Debug | "Not found" |
| Business | Quota exceeded | 422 | Info | Specific reason |
| Internal | DB crash | 500 | Error | "Something went wrong" |

### 7.2 Error Propagation
How errors flow: domain → service → handler → HTTP response.

## 8. Configuration

### 8.1 Config Sources
Hierarchy: defaults → config file → env vars → CLI flags.

### 8.2 Config Schema
| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|

## 9. Testing Strategy

### 9.1 Test Pyramid
| Level | Tool | Scope | Target |
|-------|------|-------|--------|
| Unit | [tool] | Functions, methods | 80%+ on business logic |
| Integration | [tool] | API + DB | All endpoints |
| E2E | [tool] | Full flows | Critical paths |

### 9.2 Test Patterns
Factory functions, test DB setup/teardown, mocking strategy.

### 9.3 CI Pipeline
Push/PR → Lint → Type Check → Unit Tests → Integration Tests → Build → [Deploy]

## 10. Security Implementation
Input sanitization points, secret management, security headers.

## 11. Deployment
Build command, Dockerfile, health check, monitoring.

## 12. Development Workflow
Local setup steps, code standards, git workflow.
```

## Quality Checklist

- [ ] Every tech choice has a specific rationale
- [ ] Directory structure is file-level complete
- [ ] Module breakdown covers all specification features
- [ ] Design patterns are recommended with code sketches
- [ ] Database schema implements full data model
- [ ] API routes cover all specification endpoints
- [ ] Error handling is defined with classification table
- [ ] Configuration is documented with types and defaults
- [ ] Testing strategy has concrete tool choices
- [ ] Cross-references to SPECIFICATION.md sections are present
- [ ] A developer with this + spec could start coding immediately
