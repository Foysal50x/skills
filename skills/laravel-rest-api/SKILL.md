---
name: laravel-rest-api
description: REST API and HTTP-edge rules for Laravel — authorization before the domain runs, validation and DTO construction in Form Requests, scoped route model binding for nested resources, JSON output through Resources, thin controllers, and domain exceptions mapped to status codes centrally. Also covers outbound calls — HTTP client timeouts, retries, status handling and pooling. Use when writing or reviewing routes, controllers, form requests, API resources, policies, exception handling, or any call to a third-party API in a Laravel application.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.1.2"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel HTTP

Rules for the edge of a Laravel application, inbound and outbound: 37 rules across 7 sections.

The edge has one job — translate HTTP into domain types and back. `Illuminate\Http\Request` stops at the controller or Form Request; nothing inward ever sees it. See the `laravel-patterns` skill for what happens after that.

## Non-Negotiables

- Exactly one authorization site per route. Never a Form Request `authorize()` and a controller `Gate::authorize()` on the same route.
- No query construction in a controller, Form Request, Resource or Blade view — including a single `where()` with `paginate()`, and including relations read off `$request->user()`.
- Any parameter carrying a password, token, key or raw personal data is marked `#[\SensitiveParameter]`.
- Every outbound call sets a timeout and decides what each status code means. No test reaches the network.

## When to Apply

- Adding or reviewing a route, controller, Form Request, Resource or Policy
- Building a nested resource URL (`/conversations/{conversation}/messages/{message}`)
- Deciding where an authorization check goes
- Turning a domain exception into an HTTP response
- Reviewing an API payload shape before clients depend on it

## Pick the Rule

| About to write | Read |
|----------------|------|
| Any new endpoint | `authz-exactly-one-authorization-site`, `controller-thin-delegates-to-action` |
| Validation for a payload | `request-validation-in-form-requests`, `request-to-dto` |
| An ownership or tenancy check | `authz-policies-per-model`, `authz-never-trust-request-ids` |
| An endpoint that lists records | `controller-no-query-construction` |
| A nested resource URL | `route-scoped-bindings-for-nested-resources`, `route-shallow-nesting` |
| A JSON response | `resource-json-resource-only`, `resource-when-loaded-for-relations` |
| A `throw` | `error-context-specific-exception-classes`, `error-map-status-centrally` |
| A function taking a password, token or key | `error-sensitive-parameter-attribute` |
| A route file entry | `route-model-binding-over-manual-lookup`, `route-cacheable-controller-routes` |
| A call to a third-party API | `client-explicit-timeouts`, `client-handle-status-explicitly` |
| A URL that came from a request | `client-reject-user-supplied-urls` |
| A POST a client may retry | `controller-idempotency-key-on-unsafe-writes` |
| A call that fails intermittently | `client-retry-with-backoff` |
| Several independent API calls | `client-pool-concurrent-requests` |

## Before You Write Code

- Every API named in these rules is verified against Laravel `^12.0 || ^13.0` and PHP `^8.3`. If you need something these rules do not name, check the docs — never infer an API from its name.
- Version-gated APIs are marked inline ("Laravel 13 only"). Read the project's `composer.json` first; on Laravel 12 use the fallback the rule gives.
- Where the project already differs from a rule, follow the project. Name the rule you set aside and why, rather than half-converting the codebase.
- When two rules collide, the higher-impact section wins — sections are ordered by impact.
- One example is not the whole rule. Open `rules/{slug}.md` before adapting it to a case the example does not show.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Authorization | CRITICAL | `authz-` |
| 2 | Form Requests and Validation | HIGH | `request-` |
| 3 | Routing and Model Binding | HIGH | `route-` |
| 4 | API Serialization | HIGH | `resource-` |
| 5 | Errors and Exceptions | MEDIUM-HIGH | `error-` |
| 6 | Controllers | MEDIUM-HIGH | `controller-` |
| 7 | Outbound HTTP | MEDIUM-HIGH | `client-` |

## Quick Reference

### 1. Authorization (CRITICAL)

- `authz-check-before-the-domain-runs` — Authorize at the edge, before the Action executes
- `authz-exactly-one-authorization-site` — One authorization site per route, never two
- `authz-policies-per-model` — Put the rule in a Policy, not in a conditional
- `authz-never-trust-request-ids` — An ID in a request is a claim, not a fact

### 2. Form Requests and Validation (HIGH)

- `request-validation-in-form-requests` — Validation lives in a Form Request
- `request-authorize-in-form-request` — Put the authorization decision in `authorize()`
- `request-to-dto` — Convert the validated payload into a DTO
- `request-prepare-for-validation-normalizes` — Normalize input before the rules run
- `request-array-rules-per-item` — Validate array items, not just the array
- `request-never-pass-request-inward` — The `Request` stops at the controller

### 3. Routing and Model Binding (HIGH)

- `route-model-binding-over-manual-lookup` — Bind models instead of looking them up
- `route-scoped-bindings-for-nested-resources` — Scope nested bindings to their parent
- `route-parameter-matches-model` — Name the parameter after the bound model
- `route-consistent-prefixes-no-double-nesting` — Keep prefixes and paths consistent
- `route-shallow-nesting` — Nest only as deep as the parent is needed
- `route-missing-callback` — Handle a missing bound model deliberately
- `route-cacheable-controller-routes` — No closure routes, so `route:cache` works

### 4. API Serialization (HIGH)

- `resource-json-resource-only` — Serialize through a Resource, never a raw Model
- `resource-when-loaded-for-relations` — Guard relations with `whenLoaded()`
- `resource-live-in-domain` — Resources live with their domain
- `resource-stable-payload-shape` — Explicit wire types, stable keys
- `resource-jsonapi-when-the-spec-applies` — First-party JSON:API resources (Laravel 13)

### 5. Errors and Exceptions (MEDIUM-HIGH)

- `error-context-specific-exception-classes` — Never throw a bare `Exception`
- `error-named-constructors` — A named constructor per failure mode
- `error-map-status-centrally` — Map exceptions to status once, in the handler
- `error-never-leak-internals` — Log the detail, return a stable message
- `error-sensitive-parameter-attribute` — Mark secret parameters `#[\SensitiveParameter]`

### 6. Controllers (MEDIUM-HIGH)

- `controller-thin-delegates-to-action` — Map HTTP, delegate, shape the response
- `controller-invokable-single-action` — Prefer single-action invokable controllers
- `controller-no-query-construction` — A controller constructs no queries
- `controller-attributes-for-middleware-and-authorization` — `#[Middleware]` / `#[Authorize]` (Laravel 13)
- `controller-idempotency-key-on-unsafe-writes` — A client retry must not create a second record

### 7. Outbound HTTP (MEDIUM-HIGH)

- `client-explicit-timeouts` — A timeout and a connect timeout on every call
- `client-retry-with-backoff` — Retry transient failures only, with increasing delays
- `client-handle-status-explicitly` — Throw, or handle the status; never parse an error body
- `client-pool-concurrent-requests` — Pool independent calls instead of waiting three times
- `client-reject-user-supplied-urls` — Never fetch an address the client chose

## Version Notes

| Feature | Availability |
|---------|--------------|
| `#[Middleware]`, `#[Authorize]` on controllers | Laravel 13+ |
| First-party JSON:API resources | Laravel 13+ |
| `PreventRequestForgery` (origin-aware CSRF) | Laravel 13+ |
| `->scopeBindings()`, `->missing()` | Laravel 9+ |
| `#[\SensitiveParameter]` | PHP 8.2+ |
| `bootstrap/app.php` exception configuration | Laravel 11+ |

## Reference Material

- `references/request-lifecycle-boundaries.md` — what each edge layer may and may not do
- `references/nested-routing-recipes.md` — worked nested-resource route definitions
- `references/checklist.md` — pre-merge self-check for the HTTP layer

## How to Use

Load in this order and stop when the answer is clear:

1. This file — the Quick Reference names every rule, and usually settles the question.
2. One rule file for the reasoning and both examples (~408 tokens each):

```
rules/route-scoped-bindings-for-nested-resources.md
rules/resource-when-loaded-for-relations.md
```

3. A `references/` file only when a rule points at one.

`AGENTS.md` is every rule compiled into one document (~12k tokens), for agents that read the AGENTS.md convention. Do not load it when the individual rule files are reachable.

## Related Skills

- `laravel-engineering` — read callers and configuration before changing a boundary
- `laravel-patterns` — where the logic goes once the request is translated
- `laravel-eloquent` — pagination, eager loading and query rules behind the Repository
- `laravel-async` — dispatching work from a request without blocking the response
- `laravel-testing` — feature tests, authorization tests and query-count assertions
