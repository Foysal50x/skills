---
title: No Generic BaseRepository
impact: HIGH
impactDescription: removes the single largest source of repository boilerplate
tags: repository, anti-pattern, inheritance
---

## No Generic BaseRepository

A shared `BaseRepository` or generic `RepositoryInterface` with `find/all/create/update/delete` is dead boilerplate wrapped around Eloquent. It gives every model a layer none of them earned, and it forces every domain to inherit methods it does not want in its contract.

Start each Repository plain and domain-specific. Share code only after real, repeated duplication — and even then prefer composition over a base class.

**Incorrect:**

```php
abstract class BaseRepository
{
    public function __construct(protected Model $model) {}

    public function all(): Collection { return $this->model->all(); }
    public function find(int $id): ?Model { return $this->model->find($id); }
    public function create(array $data): Model { return $this->model->create($data); }
    public function update(int $id, array $data): bool { return $this->find($id)?->update($data) ?? false; }
    public function delete(int $id): bool { return (bool) $this->model->destroy($id); }
}

final class OrderRepository extends BaseRepository {}
final class TenantRepository extends BaseRepository {}
```

**Correct (models that need nothing get nothing):**

```php
// Orders earned a repository (Q5(b)):
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

// Tenant did not. Use Eloquent:
$tenant = Tenant::findOrFail($id);
```
