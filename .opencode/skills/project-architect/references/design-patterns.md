# Design Patterns Reference

When generating IMPLEMENTATION.md, consult this catalog to recommend patterns that fit the
project's specific needs. Don't recommend patterns for their own sake — each recommendation
must solve a concrete problem in THIS project.

## Architecture Patterns

### Layered Architecture
**When:** Most applications with clear separation between presentation, business logic, and data.
**Structure:** Handler/Controller → Service/UseCase → Repository/DataAccess → Database
**Trade-off:** Clear separation vs. potential over-abstraction for simple apps.

### Clean Architecture / Hexagonal (Ports & Adapters)
**When:** Business logic must be testable independently of frameworks, databases, and external services.
**Structure:** Domain (entities + interfaces) → UseCases → Adapters (DB, HTTP, external APIs)
**Trade-off:** Maximum testability and flexibility vs. more boilerplate and indirection.

### Modular Monolith
**When:** Project needs clear module boundaries but microservices are premature.
**Structure:** Single deployable with internal module boundaries, each module owns its data.

### Microservices
**When:** Independent deployment needed, different scaling per service, polyglot requirements.
**Trade-off:** Independent scaling vs. distributed system complexity.

### Event-Driven Architecture
**When:** Loose coupling between components, async processing, audit trails.
**Structure:** Events → Event Bus → Handlers.

### CQRS (Command Query Responsibility Segregation)
**When:** Read and write patterns are very different. High read-to-write ratio.
**Trade-off:** Optimized read/write paths vs. complexity of maintaining separate models.

## Structural Patterns

### Repository Pattern
**When:** Data access needs abstraction for testability, or multiple storage backends.
```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<User>
  delete(id: string): Promise<void>
}
```

### Service Layer
**When:** Business logic spans multiple entities or requires orchestration.
```typescript
class OrderService {
  constructor(
    private orders: OrderRepo,
    private inventory: InventoryRepo,
    private payments: PaymentGateway
  ) {}
  async placeOrder(input: PlaceOrderInput): Promise<Order> { /* orchestration */ }
}
```

### Factory Pattern
**When:** Object creation is complex, has variants, or needs to be centralized.

### Strategy Pattern
**When:** Algorithm or behavior needs to be swappable at runtime.
**Common use:** Different auth strategies, payment processors, notification channels, storage backends.

### Adapter Pattern
**When:** Integrating with external APIs or services that might change.
**How:** Wrap external interfaces behind your own interface.

### Middleware / Pipeline Pattern
**When:** Request processing needs composable, ordered transformations.
**Common use:** HTTP middleware (auth, logging, CORS, rate limiting), plugin systems.

### Builder Pattern
**When:** Complex object construction with many optional parameters.
**Common use:** Query builders, configuration objects, HTTP request builders, test fixtures.

## Behavioral Patterns

### Observer / Event Emitter
**When:** Components need to react to state changes without tight coupling.
**Common use:** UI state changes, domain events, webhook triggers, cache invalidation.

### Command Pattern
**When:** Operations need to be queued, logged, undone, or retried.
**Common use:** Task queues, undo systems, audit logging, CLI command routing.

### State Machine
**When:** Entity has well-defined states with controlled transitions.
**Common use:** Order status, workflow engines, UI wizards, connection management.

### Chain of Responsibility
**When:** Request handling needs to cascade through multiple handlers until one processes it.
**Common use:** Validation chains, error handling, permission checks.

## Data Patterns

### Unit of Work
**When:** Multiple data operations must succeed or fail together.

### Data Mapper vs Active Record
**Data Mapper:** Entity objects are pure data, separate mapper handles persistence.
**Active Record:** Entity objects include persistence methods (save, delete).

### DTO (Data Transfer Object)
**When:** Internal domain models differ from API request/response shapes.
**How:** Separate types for API boundaries, map between domain ↔ DTO.

### Specification Pattern
**When:** Complex query conditions need to be composable and reusable.
**Common use:** Advanced search/filter systems, business rule evaluation.

### Event Sourcing
**When:** Complete audit trail needed, temporal queries, complex domain with undo.
**Trade-off:** Perfect audit trail vs. complexity of event replay and projections.

## API Patterns

### RESTful Resource Design
- Nouns as resources (`/users`), HTTP verbs as operations
- Plural nouns, nested resources (`/users/:id/orders`)
- Consistent filtering (`?status=active&sort=created_at`)

### Pagination
- **Offset-based:** `?page=2&limit=20` — simple, allows jumping
- **Cursor-based:** `?cursor=abc123&limit=20` — better for real-time data

### Error Response Pattern
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email format is invalid",
    "details": { "field": "email", "value": "not-an-email" },
    "request_id": "req_abc123"
  }
}
```

## Concurrency Patterns

### Worker Pool
**When:** Processing many independent tasks with controlled parallelism.

### Fan-out / Fan-in
**When:** A task can be split into parallel sub-tasks and results merged.

### Circuit Breaker
**When:** Calling unreliable external services that might be down or slow.

### Retry with Backoff
**When:** Transient failures that succeed on retry (network, rate limits).

## Security Patterns

### Input Validation Pipeline
**When:** Always. Validate at the boundary, never trust downstream.

### Least Privilege Access
**When:** Multi-user systems with different permission levels.
**Implementation:** RBAC for most apps, ABAC for complex rules.

### Secret Management
- **Development:** `.env` files (gitignored)
- **Production:** Environment variables, vault services
- **Never:** Hardcoded secrets in committed files

## Pattern Selection Guide

| Project Characteristic | Recommended Patterns |
|-----------------------|---------------------|
| Simple CRUD API | Layered Architecture, Service Layer, DTO, RESTful Resources |
| Complex business logic | Clean Architecture, Repository, Service Layer, State Machine |
| Multiple external APIs | Adapter, Circuit Breaker, Retry with Backoff, Strategy |
| Real-time features | Observer/Event Emitter, Worker Pool, WebSocket handler |
| Multi-user with roles | RBAC, Middleware pipeline, Least Privilege |
| High-traffic API | Rate Limiting, Caching, Pagination, Worker Pool |
| Plugin/extension system | Strategy, Middleware pipeline, Factory, Event-driven |
| CLI tool | Command pattern, Builder (for config), Chain of Responsibility |
| Full-stack web app | Container/Presentational, Optimistic Updates, Service Layer |
| Data-intensive | Repository, Unit of Work, CQRS (if read/write differ), Event Sourcing |

When recommending, always include:
1. The pattern name
2. Which specific project problem it solves
3. A 5-15 line code sketch showing the pattern in the project's language and domain
