# Worked example: the Orders domain

One vertical slice showing every layer in its correct place. Copy the shape, not the business rules.

```
app/
  Support/Filters/
    Date/DateRange.php            pure VO — no Builder
    Sorting.php  Direction.php    pure VO — no Builder
  Domain/Orders/
    Contracts/OrderRepositoryInterface.php    public contract, domain types
    Filters/OrderQueryFilter.php              composite filter DTO
    Queries/SearchOrdersQuery.php             INTERNAL — owns all where()/orderBy()
    Queries/ExpireAbandonedOrdersQuery.php    INTERNAL — a conditional bulk write
    Repositories/EloquentOrderRepository.php  composes queries, executes to domain types
    Actions/PlaceOrderAction.php              one use case end to end
  Http/
    StoreOrderRequest.php         validation + toDto()
    OrderIndexController.php      maps Request → Value Objects
```

## The boundaries this example demonstrates

- `DateRange` and `Sorting` hold data and pure predicates. Neither imports `Builder`.
- `SearchOrdersQuery` is the only file that writes `where()` and `orderBy()`, and it whitelists sortable columns.
- `OrderRepositoryInterface` returns `LengthAwarePaginator`, `Collection` and `int` — never `Builder`.
- `OrderIndexController` builds Value Objects from the `Request`; nothing inward sees HTTP.
- `PlaceOrderAction` orchestrates one use case and announces `OrderPlaced` after the transaction commits.
- Nothing outside `Repositories/` imports anything from `Queries/`.
