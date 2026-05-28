# Specification Guide

How to write SPECIFICATION.md — the foundational document that captures **what** the project
is and **what** it does. This document is technology-aware but implementation-agnostic.

## Principles

1. **Behavior over implementation.** Describe what happens, not how it's coded.
2. **Specific boundaries.** Every feature has clear scope, quantified where possible.
3. **Include non-goals.** What the project does NOT do is equally important.
4. **Write for the implementer.** Someone with only this document should understand full scope.
5. **Mark unknowns.** Use `[TBD: reason]` for undecided aspects — never guess.

## Template

```markdown
# [Project Name] — Specification

## 1. Overview
- What Is [Project Name]? (2-3 paragraphs: what, problem, who, approach)
- Target Audience (specific segments)
- Key Differentiators (3-5 concrete, quantified bullets)
- Competitive Landscape (table comparing with alternatives)

## 2. Core Concepts
Domain vocabulary. Every important term defined to prevent ambiguity.

## 3. Functional Requirements
Organized by feature groups. Each feature includes:
- User story: As a [role], I want to [action] so that [benefit]
- Detailed description from user perspective
- Acceptance criteria (testable, verifiable)
- Edge cases (empty, exceeded limits, concurrent access)
- Constraints (size limits, rate limits, format restrictions)

## 4. Architecture Overview
Conceptual view — NOT implementation plan.
- System Components (name and describe each major component)
- Component Interactions (how components communicate, data flow, sync/async)
- External Integrations (third-party services, why needed, fallback if unavailable)

## 5. Data Model
- Core Entities (table: field, type, required, description, constraints)
- Relationships (one-to-many, many-to-many, clear notation)
- Data Lifecycle (CRUD, soft/hard delete, retention)

## 6. API Surface
- API Style (REST/GraphQL/gRPC/WebSocket, why chosen)
- Endpoint Overview (table: method, path, description, auth)
- Authentication & Authorization
- Rate Limiting
- Error Format (standard error response structure)

## 7. User Interface (if applicable)
- Interface Type (Web UI / CLI / TUI / Desktop / Mobile)
- Key Screens (purpose, elements, actions, navigation)
- Responsive Requirements (breakpoints, mobile, accessibility)

## 8. Security Model
- Authentication (method, token format, session management)
- Authorization (permission model, roles)
- Data Protection (encryption, PII handling)
- Input Validation

## 9. Deployment Model
- Target Environments
- Distribution Method (Docker, binary, package manager, SaaS)
- Configuration (env vars, config files, CLI flags)
- System Requirements

## 10. Performance Requirements
- Response Time Targets (p50/p95/p99)
- Throughput Targets
- Resource Limits

## 11. Constraints & Non-Goals
- Technical Constraints
- Non-Goals (5+ items to prevent scope creep)
- Assumptions (risk if broken)
- Open Questions ([TBD] items with context and options)

## 12. Future Considerations
Capabilities planned for later versions. Helps design for extensibility.
```

## Section Selection

| Section | Include When |
|---------|-------------|
| Competitive Landscape | Project has identifiable alternatives |
| API Surface | Any programmatic interface |
| User Interface | Any visual interface |
| Security Model | Handles user data, auth, or is network-facing |
| Performance Requirements | Has measurable performance needs |
| Data Model | Persists or processes structured data |
| Deployment Model | Always |
| Future Considerations | Project has a roadmap |

## Quality Checklist

- [ ] Every feature has testable acceptance criteria
- [ ] Data model covers all entities mentioned in features
- [ ] API endpoints cover all features needing programmatic access
- [ ] Non-goals list has 5+ items
- [ ] No implementation details in functional requirements
- [ ] No vague language without quantification
- [ ] Open questions flagged with [TBD]
- [ ] Core concepts table defines all domain-specific terms
- [ ] A developer could understand full scope from this document alone
