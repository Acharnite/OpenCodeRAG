# Tech Stack Advisor

Interactive technology selection guide. When the user needs help choosing a stack, walk them
through decisions using `AskUserQuestion` with clear trade-offs for each option.

**Important:** Always verify the LATEST stable versions of recommended technologies via web
search before including them in documents.

## Decision 1: Programming Language

### Web Application / API Service

| Language | Best For | Trade-off |
|----------|----------|-----------|
| TypeScript | Full-stack with shared types, rapid prototyping, large ecosystem | Runtime overhead, single-threaded without workers |
| Go | High-performance APIs, microservices, CLI tools, infrastructure | Verbose error handling, smaller web ecosystem |
| Python | Data-heavy apps, ML integration, scripting, rapid prototyping | Slower runtime, GIL limitations for concurrency |
| Rust | Maximum performance, system-level control, safety-critical | Steep learning curve, slower development velocity |

### CLI Tool / System Utility

| Language | Best For | Trade-off |
|----------|----------|-----------|
| Go | Fast compilation, single binary, cross-platform, great stdlib | Less expressive type system |
| Rust | Maximum performance, zero-cost abstractions, no GC | Longer compile times, steeper learning curve |
| TypeScript | Rapid development, npm ecosystem, Bun for speed | Requires runtime (Node/Bun) |
| Python | Scripting, automation, data processing, rapid prototyping | Requires Python runtime on target machine |

## Decision 2: Web Framework

### TypeScript / Node.js

| Framework | Best For | Trade-off |
|-----------|----------|-----------|
| Next.js | Full-stack React apps, SSR/SSG, Vercel ecosystem | React-locked, complex mental model |
| Fastify | High-performance APIs, schema validation, plugin system | API-only, no built-in frontend |
| Hono | Edge-first, ultra-lightweight, multi-runtime | Newer, smaller ecosystem |
| Express | Maximum flexibility, largest ecosystem | Minimal built-in features |
| NestJS | Enterprise patterns, dependency injection, TypeScript-first | Heavy abstraction |

### Go

| Approach | Best For | Trade-off |
|----------|----------|-----------|
| net/http (stdlib) | Maximum control, zero dependencies, learning Go | More boilerplate |
| Chi | Idiomatic Go, stdlib-compatible, lightweight middleware | Minimal features beyond routing |
| Echo | Balance of features and performance, good docs | Slightly opinionated |
| Gin | Most popular, large community, middleware ecosystem | Some magic, less idiomatic |

### Python

| Framework | Best For | Trade-off |
|-----------|----------|-----------|
| FastAPI | Modern APIs, automatic OpenAPI docs, async, type hints | API-focused, no built-in admin/ORM |
| Django | Full-stack, admin panel, ORM, batteries included | Monolithic, heavier |
| Flask | Minimal, flexible, large extension ecosystem | Assemble everything yourself |

## Decision 3: Database

### Relational (SQL)

| Database | Best For | Trade-off |
|----------|----------|-----------|
| PostgreSQL | Complex queries, JSONB support, extensions, full-text search | Heavier for simple use cases |
| MySQL/MariaDB | Proven at scale, wide hosting support, replication | Fewer advanced features than Postgres |
| SQLite | Embedded, zero-config, single-file, edge/mobile | Single-writer limitation, no built-in replication |

## Decision 4: Frontend

- React ecosystem (Next.js, Vite+React, Remix, TanStack Start)
- Vue ecosystem (Nuxt, Vite+Vue)
- Svelte / SvelteKit
- Server-rendered (HTMX / Alpine)
- No frontend (API only)

### CSS / Styling

- Tailwind CSS
- CSS Modules
- Styled Components / Emotion
- Vanilla CSS

### Component Library

- shadcn/ui (copy-paste, Radix + Tailwind)
- MUI / Material UI
- Ant Design
- None (custom components)

## Decision 5: Authentication

| Approach | Best For | Trade-off |
|----------|----------|-----------|
| Auth library (NextAuth / Lucia / Passport) | Control + convenience, self-hosted | More setup than a service |
| Auth service (Clerk / Auth0 / Supabase Auth) | Fastest to implement, managed, social login | Vendor lock-in, cost at scale |
| Custom implementation | Full control, no dependencies, learning | Security risk if done wrong |

## Decision 6: ORM / Data Access

### TypeScript

| ORM | Best For | Trade-off |
|-----|----------|-----------|
| Prisma | Schema-first, excellent DX, migrations, type safety | Generated client size |
| Drizzle | SQL-like syntax, lightweight, type-safe, edge-compatible | Newer, maturing |
| TypeORM | Decorator-based, Active Record or Data Mapper | Complex, heavier |
| Knex | Query builder, flexible, close to SQL | No entity mapping |

### Go

| ORM | Best For | Trade-off |
|-----|----------|-----------|
| sqlc | Type-safe, generates code from SQL, excellent performance | Schema-first, less dynamic |
| GORM | Full-featured ORM, large community | Magic-heavy, implicit behavior |
| sqlx | Thin wrapper over database/sql, struct scanning | Manual SQL writing |

### Python

| ORM | Best For | Trade-off |
|-----|----------|-----------|
| SQLAlchemy | Powerful, mature, flexible | Complex API surface |
| Django ORM | Integrated with Django, excellent DX | Django-only |
| Tortoise ORM | Async-native, Django-like API | Newer, smaller community |

## Decision 7: Testing

### TypeScript Testing

- Vitest (fast, Vite-native, Jest-compatible)
- Jest (most popular, large ecosystem)
- Bun test (fastest, built into Bun)

### E2E Testing

- Playwright (cross-browser, modern API)
- Cypress (developer-friendly, great DX)
- None for now

## Decision 8: Deployment & Infrastructure

- Container (Docker / Podman)
- Serverless (Vercel / Cloudflare / AWS Lambda)
- Traditional server (VPS / bare metal)
- Platform-as-a-Service (Railway / Render / Fly.io)

### CI/CD

- GitHub Actions
- GitLab CI
- Self-hosted
- None yet

## Stack Templates

### Modern Full-Stack Web App
TypeScript + Next.js + PostgreSQL + Prisma/Drizzle + Tailwind + shadcn/ui + NextAuth + Vitest + Playwright + Docker + GitHub Actions

### High-Performance API Service
Go + Chi/Echo + PostgreSQL + sqlc + Docker + GitHub Actions

### Developer CLI Tool
Go + Cobra + SQLite (if storage needed) + goreleaser

### Real-time Application
TypeScript + Fastify + PostgreSQL + Redis + WebSocket + React + Vite

### Lightweight Self-Hosted Tool
Go + net/http + SQLite + embedded HTML templates + single binary

Present these as starting points that the user can customize.
