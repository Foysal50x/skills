---
name: laravel-http
description: HTTP-edge rules for Laravel — authorization before the domain runs, validation and DTO construction in Form Requests, scoped route model binding for nested resources, JSON output through Resources, thin controllers, and domain exceptions mapped to status codes centrally. Use when writing or reviewing routes, controllers, form requests, API resources, policies or exception handling in a Laravel application.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.0.0"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel HTTP

Rules for the edge of a Laravel application: 31 rules across 6 sections.

The edge has one job — translate HTTP into domain types and back. `Illuminate\Http\Request` stops at the controller or Form Request; nothing inward ever sees it. See the `laravel-patterns` skill for what happens after that.

## Non-Negotiables

- Exactly one authorization site per route. Never a Form Request `authorize()` and a controller `Gate::authorize()` on the same route.
- No query construction in a controller, Form Request, Resource or Blade view — including a single `where()` with `paginate()`, and including relations read off `$request->user()`.
- Any parameter carrying a password, token, key or raw personal data is marked `#[\SensitiveParameter]`.

## When to Apply

- Adding or reviewing a route, controller, Form Request, Resource or Policy
- Building a nested resource URL (`/conversations/{conversation}/messages/{message}`)
- Deciding where an authorization check goes
- Turning a domain exception into an HTTP response
- Reviewing an API payload shape before clients depend on it

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Authorization | CRITICAL | `authz-` |
| 2 | Form Requests and Validation | HIGH | `request-` |
| 3 | Routing and Model Binding | HIGH | `route-` |
| 4 | API Serialization | HIGH | `resource-` |
| 5 | Errors and Exceptions | MEDIUM-HIGH | `error-` |
| 6 | Controllers | MEDIUM-HIGH | `controller-` |

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
- `route-cacheable-controller-routes` — Point every route at a controller class

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

Read individual rule files for the full explanation and both code examples:

```
rules/route-scoped-bindings-for-nested-resources.md
rules/resource-when-loaded-for-relations.md
```

For the complete guide with every rule expanded: `AGENTS.md`.

## Related Skills

- `laravel-patterns` — where the logic goes once the request is translated
- `laravel-eloquent` — pagination, eager loading and query rules behind the Repository
- `laravel-async` — dispatching work from a request without blocking the response
- `laravel-testing` — feature tests, authorization tests and query-count assertions
