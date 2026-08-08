# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. The Decision Gate (gate)

**Impact:** CRITICAL
**Description:** Run before creating any class. Answer the gate questions in order and stop at the first match. Skipping the gate is how a codebase grows a Repository for every model or scatters queries across Actions.

## 2. Actions (action)

**Impact:** HIGH
**Description:** An Action orchestrates exactly one use case end to end. It is the default home for logic — extraction to another layer must be earned.

## 3. Services (service)

**Impact:** HIGH
**Description:** A Service holds one business decision reused by two or more Actions. Premature Services are the most common over-abstraction in Laravel codebases.

## 4. Repositories (repo)

**Impact:** HIGH
**Description:** The Repository interface is the only public data-access boundary. It exists to make a backend swappable or to give an important query a single change point — never "for consistency".

## 5. Query Classes (query)

**Impact:** HIGH
**Description:** A Query Class is one named Eloquent query behind a single `handle()`. It is the only place query construction lives, and it is internal to Repository implementations.

## 6. Value Objects and Parameter Isolation (vo)

**Impact:** MEDIUM-HIGH
**Description:** Group related or recurring parameters into immutable Value Objects. Value Objects are pure data plus pure predicates — they never touch a Builder.

## 7. Directory and Namespace Layout (layout)

**Impact:** MEDIUM
**Description:** Layout is domain-first. Scope decides placement: shareable code goes top-level, single-domain code stays inside its domain.

## 8. Inter-Domain Communication (domain)

**Impact:** HIGH
**Description:** Domains are bounded contexts. A domain's Models, Repositories and Queries are private; only its Contracts and Events are public. Cross-domain integration uses Domain Events, an Open Host Service, the Shared Kernel, or an Anti-Corruption Layer.

## 9. Configuration and Environments (config)

**Impact:** MEDIUM
**Description:** Secrets live in `.env`, structure lives in `config/*.php`, and `env()` is never called outside `config/`. Getting this wrong breaks the moment you run `config:cache`.
