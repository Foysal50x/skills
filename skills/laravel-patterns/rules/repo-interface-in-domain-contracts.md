---
title: The Interface Lives in Contracts, the Implementation in Repositories
impact: MEDIUM
impactDescription: makes the public surface of a domain obvious from the folder tree
tags: repository, layout, contracts
---

## The Interface Lives in Contracts, the Implementation in Repositories

A Repository interface is a domain-specific contract, so it belongs in `app/Domain/<Context>/Contracts/`. The `Repositories/` folder holds implementations only. Naming: `<X>RepositoryInterface` for the contract, `<Backend><X>Repository` for each implementation.

This split makes the tree self-documenting: `Contracts/` is the domain's public surface, `Repositories/` and `Queries/` are private.

**Incorrect (contract buried among implementations):**

```
app/Domain/Orders/Repositories/
    OrderRepositoryInterface.php
    OrderRepository.php            // which backend?
```

**Correct:**

```
app/Domain/Orders/
    Contracts/
        OrderRepositoryInterface.php
    Repositories/
        EloquentOrderRepository.php
        InMemoryOrderRepository.php   // used by tests and the demo seeder
    Queries/
        SearchOrdersQuery.php
```

See `rules/domain-public-vs-private-surface.md` for why the distinction matters across domains.
