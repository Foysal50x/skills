# Data-Layer Pre-Merge Checklist

Any "No" or "Unsure" means revise.

## Performance

1. Is every relation touched by a Resource, Blade view or loop present in the query's `with([...])`?
2. Is `Model::shouldBeStrict()` enabled outside production?
3. Does any list endpoint return an unbounded `get()`?
4. Are `count()` calls that only answer yes/no replaced with `exists()`?
5. Do exports, backfills and imports use `chunkById`/`lazyById` rather than `get()` or offset `chunk()`?
6. Is every column used in `where`, `join` or `orderBy` indexed, with composite indexes in the query's column order?
7. Has `EXPLAIN` been run on any query added to a hot path?

## Pagination

8. Is the paginator chosen deliberately — `cursorPaginate()` for deep sets, `simplePaginate()` when no total is rendered, `paginate()` only when the count is part of the product?
9. Is client-supplied `per_page` capped server-side?
10. For `cursorPaginate()`, is the ordering unique (or tiebroken) and indexed?

## Transactions

11. Is every multi-row write wrapped in `DB::transaction()`?
12. Is the transaction free of HTTP calls, mail sends and file I/O?
13. Do jobs, events and notifications dispatch after commit (`after_commit` or `afterCommit()`)?
14. Is any read-modify-write sequence protected by `lockForUpdate()` or an atomic operation?
15. Do contended transactions pass `attempts:` so deadlocks retry?

## Model declaration

16. Is every date, enum, JSON, money and encrypted column cast?
17. Are dates cast as `immutable_datetime`, with `app.timezone` set to `UTC`?
18. Is `$fillable` a deliberate allow-list — no `$guarded = []`?
19. Do Value Object columns have a `CastsAttributes` class?
20. Are scopes declared with `#[Scope]` and observers with `#[ObservedBy]` (Laravel 12+)?

## Scopes and soft deletes

21. Are reusable constraints named scopes on the model rather than repeated predicates?
22. Is each filter implemented by a global scope *or* a named scope, not both?
23. Does `SoftDeletes` earn its place, and are unique indexes scoped to live rows?
24. Are `withTrashed()`/`onlyTrashed()` confined to named queries?

## Raw SQL

25. Is all raw SQL, JOIN and aggregate construction inside a Query Class or Repository?
26. Is `DB::raw()` replaced by type-safe expressions where the package covers the case?
27. Are all values passed as bindings and all identifiers allow-listed?
28. Is driver-specific SQL wrapped in an `Expression` class rather than inlined?

## Bulk operations

29. Are batch writes using `insert()`/`upsert()` in chunks rather than a `create()` loop?
30. For every bulk write, have the skipped model events been handled explicitly (cache flush, audit row, dispatched event)?
