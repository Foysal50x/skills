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
    StoreOrderRequest.php         write side: validation + toDto()
    SearchOrdersRequest.php       read side: authorize + validate + toFilter()
    OrderIndexController.php      one line — delegates and shapes the response
```

## The boundaries this example demonstrates

- `DateRange` and `Sorting` hold data and pure predicates. Neither imports `Builder`, and `Sorting` parses its own wire format in a named constructor.
- `SearchOrdersQuery` is the only file that writes `where()` and `orderBy()`, and it whitelists sortable columns.
- `OrderRepositoryInterface` returns `LengthAwarePaginator`, `Collection` and `int` — never `Builder`. `pendingOrders()` returns a `Collection` because the query bounds it; anything a client pages through returns a paginator.
- The Form Requests authorize, validate and build the Value Objects. `OrderIndexController` receives the filter already made; nothing inward sees HTTP.
- `PlaceOrderAction` orchestrates one use case and announces `OrderPlaced` **after** the transaction commits, so no queued listener can outrun the write.
- Nothing outside `Repositories/` imports anything from `Queries/`.
