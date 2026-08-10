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
8. Is every count of related rows `withCount()`/`withExists()` rather than a loaded collection?
9. Is a single value taken from a has-many pulled with an `addSelect()` subquery rather than a full eager load?
10. Does any sort by a related column use a join that multiplies rows?

## Pagination

11. Is the paginator chosen deliberately — `cursorPaginate()` for deep sets, `simplePaginate()` when no total is rendered, `paginate()` only when the count is part of the product?
12. Is client-supplied `per_page` capped server-side?
13. For `cursorPaginate()`, is the ordering unique (or tiebroken) and indexed?

## Transactions

14. Is every multi-row write wrapped in `DB::transaction()`?
15. Is the transaction free of HTTP calls, mail sends and file I/O?
16. Do jobs, events and notifications dispatch after commit (`after_commit` or `afterCommit()`)?
17. Is any read-modify-write sequence protected by `lockForUpdate()` or an atomic operation?
18. Do contended transactions pass `attempts:` so deadlocks retry?

## Model declaration

19. Is every date, enum, JSON, money and encrypted column cast?
20. Are dates cast as `immutable_datetime`, with `app.timezone` set to `UTC`?
21. Is `$fillable` a deliberate allow-list — no `$guarded = []`?
22. Do Value Object columns have a `CastsAttributes` class?
23. Are scopes declared with `#[Scope]` and observers with `#[ObservedBy]` (Laravel 12+)?

## Scopes and soft deletes

24. Are reusable constraints named scopes on the model rather than repeated predicates?
25. Is each filter implemented by a global scope *or* a named scope, not both?
26. Does `SoftDeletes` earn its place, and are unique indexes scoped to live rows?
27. Are `withTrashed()`/`onlyTrashed()` confined to named queries?

## Migrations

28. Has any migration in this change already run outside your machine? If so, is the change a new migration rather than an edit?
29. Does each migration hold either structure or data, never both?
30. Does every foreign key use `constrained()` with an explicit delete behaviour?
31. Does `down()` reverse `up()`, or state why it cannot?
32. Does every new column default appear in the model's `$attributes` as well?

## Raw SQL

33. Is all raw SQL, JOIN and aggregate construction inside a Query Class or Repository?
34. Is `DB::raw()` replaced by type-safe expressions where the package covers the case?
35. Are all values passed as bindings and all identifiers allow-listed?
36. Is driver-specific SQL wrapped in an `Expression` class rather than inlined?

## Bulk operations

37. Are batch writes using `insert()`/`upsert()` in chunks rather than a `create()` loop?
38. For every bulk write, have the skipped model events been handled explicitly (cache flush, audit row, dispatched event)?
