---
title: Queue Anything Slow or Externally Dependent
impact: HIGH
impactDescription: response time stops depending on third parties
tags: jobs, queues, performance, latency
---

## Queue Anything Slow or Externally Dependent

Report generation, exports, webhook delivery, image processing, third-party API calls, bulk mail — none of these belong in a request cycle. A slow upstream should not turn into a slow endpoint, and a failing upstream should not turn into a failed request.

The request writes state and queues work. The response returns immediately.

**Incorrect (response blocked on two external services):**

```php
final class ExportOrdersController
{
    public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): BinaryFileResponse
    {
        $rows = $orders->searchOrders($request->toFilter(), perPage: 100000);
        $path = (new FastExcel($rows))->export(storage_path('export.xlsx'));

        Mail::to($request->user())->send(new ExportReady($path));   // SMTP round trip

        return response()->download($path);
    }
}
```

**Correct:**

```php
final class ExportOrdersController
{
    public function __invoke(SearchOrdersRequest $request, PlaceExportAction $action): JsonResponse
    {
        $export = $action->handle($request->user(), $request->toFilter());

        return response()->json(['export_id' => $export->id, 'status' => 'queued'], 202);
    }
}
```

```php
final class GenerateOrderExport implements ShouldQueue
{
    public function handle(OrderRepositoryInterface $orders): void
    {
        $rows = $orders->streamMatching($this->filter);
        // write, store, then notify
    }
}
```

Return 202 with a resource the client can poll, or push completion over a broadcast channel.
