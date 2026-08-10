---
title: A List Endpoint Is a Named Query
impact: CRITICAL
impactDescription: settles the Q4/Q5 tie for reads before it is decided per file
tags: gate, repository, query-class, reads, pagination
---

## A List Endpoint Is a Named Query

Q4 ("Eloquent directly") covers single-record work: `find()`, a route-bound model, `create()`, `$model->update()`. It does not cover a list.

A paginated list always carries rules — an ownership constraint, a default ordering, a page-size cap, optional filters, an allow-list of sortable columns. That is Q5(b): a Repository method with a Query Class behind it. Deciding this per endpoint is what produces one domain with a Repository and the next with `Model::query()` in a controller.

**Incorrect (a list assembled at the edge because it looked simple):**

```php
final class ListTagsController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $tags = Tag::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('name')
            ->paginate(50);

        return TagResource::collection($tags);
    }
}
```

Ownership, ordering and page size now live in a controller. The export, the picker and the admin screen each copy all three, and the day tags gain `archived_at` three files need the same `where`.

**Correct (the rules live in one named query):**

```php
// Contracts/TagRepositoryInterface.php — Trigger: Q5(b), the owned-tag list
// drives the index endpoint, the picker and the CSV export.
public function ownedBy(User $user, TagFilter $filter): LengthAwarePaginator;

// Repositories/EloquentTagRepository.php
public function ownedBy(User $user, TagFilter $filter): LengthAwarePaginator
{
    return $this->ownedTags->handle($user, $filter)->paginate($filter->perPage());
}

// Queries/OwnedTagsQuery.php
public function handle(User $user, TagFilter $filter): Builder
{
    return Tag::query()
        ->where('user_id', $user->getKey())
        ->whereNull('archived_at')
        ->when($filter->search(), fn (Builder $q, string $term) => $q->where('name', 'like', "{$term}%"))
        ->orderBy($filter->sortColumn(), $filter->direction()->value);
}

// The controller is one line.
return TagResource::collection($tags->ownedBy($request->user(), $request->toFilter()));
```

The page-size cap lives in `TagFilter`, the sort column is whitelisted in the Query Class. See `rules/query-whitelist-sortable-columns.md`.
