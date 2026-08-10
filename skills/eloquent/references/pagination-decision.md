# Choosing a Paginator

| | `paginate()` | `simplePaginate()` | `cursorPaginate()` |
|---|---|---|---|
| Extra `COUNT` query | Yes | No | No |
| Page numbers / total | Yes | No | No |
| Jump to arbitrary page | Yes | No | No |
| Cost at page 5,000 | Degrades (OFFSET scan) | Degrades (OFFSET scan) | Constant |
| Stable when rows are inserted | No — rows shift between pages | No | Yes |
| Ordering requirement | Any | Any | Unique column, or a unique tiebreaker |

## Decide

```
Does the UI render a total or a page picker?
├── Yes → is the filtered set small, or the count cheap/cached?
│         ├── Yes → paginate()
│         └── No  → cursorPaginate() + a separately cached count
└── No  → is it deep, infinite-scroll, or a fast-growing feed?
          ├── Yes → cursorPaginate()
          └── No  → simplePaginate()
```

## Cursor pagination requirements

- Order by a unique column, or add a unique tiebreaker: `->orderBy('created_at', 'desc')->orderBy('id', 'desc')`.
- Every ordering column must be indexed, in the ordering's column order.
- The cursor encodes the ordering values, so changing the sort invalidates outstanding cursors — expected, and fine.

## API shape

Keep the response envelope stable across paginator types so clients do not branch:

```php
return OrderResource::collection($orders);   // wraps meta/links for all three
```

Cap client-supplied page size server-side:

```php
$perPage = min($request->integer('per_page', 25), 100);
```
