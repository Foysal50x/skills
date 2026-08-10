---
title: A List Endpoint Is a Named Query
impact: CRITICAL
impactDescription: settles the Q4/Q5 tie for reads before it is decided per file
tags: gate, repository, query-class, reads, pagination
---

## A List Endpoint Is a Named Query

Q4 ("Eloquent directly") covers single-record work: `find()`, a route-bound model, `$model->update()`, `create()`, `delete()`. It does not cover a list.

A paginated list always carries rules — an ownership or tenant constraint, a default ordering, a page-size cap, optional filters, an allow-list of sortable columns. That is a named query, so it takes Q5(b): a Repository method with a Query Class behind it. Deciding this per endpoint is what produces one domain with a Repository and the next with `Model::query()` in a controller.

**Incorrect (a list assembled at the edge because it "looked simple"):**

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

The ownership constraint, the ordering and the page size now live in a controller. The next endpoint that lists tags — the export, the picker, the admin screen — copies all three, and the day tags gain an `archived_at` column three files need the same `where`.

**Correct (the rules live in one named query):**

```php
// app/Domain/Tagging/Contracts/TagRepositoryInterface.php
/**
 * Trigger: Q5(b) — the owned-tag list drives the index endpoint, the picker
 * and the CSV export. One change point for ownership and ordering.
 */
interface TagRepositoryInterface
{
    public function ownedBy(User $user, TagFilter $filter): LengthAwarePaginator;
}

// app/Domain/Tagging/Repositories/EloquentTagRepository.php
final readonly class EloquentTagRepository implements TagRepositoryInterface
{
    public function __construct(private OwnedTagsQuery $ownedTags) {}

    public function ownedBy(User $user, TagFilter $filter): LengthAwarePaginator
    {
        return $this->ownedTags->handle($user, $filter)->paginate($filter->perPage());
    }
}

// app/Domain/Tagging/Queries/OwnedTagsQuery.php
final readonly class OwnedTagsQuery
{
    public function handle(User $user, TagFilter $filter): Builder
    {
        return Tag::query()
            ->where('user_id', $user->getKey())
            ->whereNull('archived_at')
            ->when($filter->search(), fn (Builder $q, string $term) => $q->where('name', 'like', "{$term}%"))
            ->orderBy($filter->sortColumn(), $filter->direction()->value);
    }
}
```

```php
final class ListTagsController
{
    public function __invoke(ListTagsRequest $request, TagRepositoryInterface $tags): AnonymousResourceCollection
    {
        return TagResource::collection($tags->ownedBy($request->user(), $request->toFilter()));
    }
}
```

The page size is capped inside `TagFilter`, the sort column is whitelisted inside the Query Class, and the controller is one line. See `rules/query-whitelist-sortable-columns.md` and `rules/gate-eloquent-directly-by-default.md`.
