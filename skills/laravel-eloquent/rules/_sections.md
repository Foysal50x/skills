# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Query Performance (perf)

**Impact:** CRITICAL
**Description:** N+1 queries and unbounded result sets are the two failures that take a Laravel app down under real traffic. Everything else on this list is smaller.

## 2. Pagination (paginate)

**Impact:** HIGH
**Description:** Every list endpoint is paginated, and the pagination type is chosen deliberately — a `COUNT` over a large table is often more expensive than the page itself.

## 3. Transactions and Consistency (tx)

**Impact:** HIGH
**Description:** Multi-step writes are atomic, transactions stay short, and side effects fire only after commit.

## 4. Model Declaration (model)

**Impact:** HIGH
**Description:** Casts, fillable and attributes are declared once on the model so no caller has to remember that a column is JSON, an enum or money.

## 5. Scopes, Global Scopes and Soft Deletes (scope)

**Impact:** MEDIUM-HIGH
**Description:** Reusable constraints belong on the model as scopes. Choose a global scope or a named scope for a given filter — not both.

## 6. Raw SQL and Query Expressions (raw)

**Impact:** MEDIUM
**Description:** JOINs, CTEs, aggregates and raw expressions are allowed and often necessary — but only inside Query Classes and Repositories, and preferably as type-safe expressions rather than `DB::raw()`.

## 7. Bulk Operations (bulk)

**Impact:** MEDIUM
**Description:** Loops that write one row at a time are the slowest thing in most import and sync jobs. Bulk operations trade model events for orders of magnitude.
