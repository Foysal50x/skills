# laravel-async

Asynchronous and caching rules for Laravel — idempotent queued jobs with retries and backoff, domain events for side effects, queue separation and failure handling, deterministic cache keys with event-driven invalidation, and scheduled tasks that queue rather than block. Use when writing or reviewing jobs, events, listeners, queue configuration, caching or scheduled tasks, or when work is duplicated, lost, or blocking a request.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. Jobs

**Impact: CRITICAL**

A queued job runs more than once. Design every handler so that running it twice produces the same result as running it once, and so a failure is retried rather than lost.

---

## Use Batches for Fan-Out and Chains for Ordered Steps

- **Batch** — many independent jobs, run in parallel, with progress tracking, cancellation and a `then`/`catch`/`finally` callback when all are done.
- **Chain** — steps that must run in order, where a failure stops the rest.

Hand-rolling either with a counter row or a job that dispatches the next one loses the failure handling.

**Incorrect (no progress, no completion hook, failures invisible):**

```php
foreach ($merchants as $merchant) {
    GenerateMonthlyStatement::dispatch($merchant->id);
}
// How do you know when they are all done? You do not.
```

**Correct (batch):**

```php
$batch = Bus::batch(
    $merchants->map(fn (Merchant $m) => new GenerateMonthlyStatement($m->id))->all(),
)
    ->name('monthly-statements')
    ->allowFailures()
    ->then(fn (Batch $batch) => StatementRunCompleted::dispatch($batch->id))
    ->catch(fn (Batch $batch, Throwable $e) => report($e))
    ->dispatch();

return response()->json(['batch_id' => $batch->id]);
```

**Correct (chain, when order matters):**

```php
Bus::chain([
    new ExtractOrders($exportId),
    new WriteSpreadsheet($exportId),
    new UploadToStorage($exportId),
    new NotifyRequester($exportId),
])->onQueue('exports')->dispatch();
```

Batches need the `job_batches` table (`php artisan queue:batches-table`). Inside a batched job, check `$this->batch()?->cancelled()` before doing expensive work.

---

## Decide What Happens When a Job Finally Fails

After the last attempt a job lands in `failed_jobs` and, by default, nothing else happens. For anything a user is waiting on, that is a silent failure: no notification, no state change, no alert.

Implement `failed()` to record the outcome, and monitor the failed queue.

**Incorrect (the export row stays "processing" forever):**

```php
final class GenerateOrderExport implements ShouldQueue
{
    public int $tries = 3;

    public function handle(): void { /* ... */ }
}
```

**Correct:**

```php
final class GenerateOrderExport implements ShouldQueue
{
    public int $tries = 3;

    public function handle(): void { /* ... */ }

    public function failed(?Throwable $e): void
    {
        // A per-row write, so the export's observers still fire.
        Export::find($this->exportId)?->markFailed(now());

        report($e);

        Notification::route('slack', config('alerts.slack'))
            ->notify(new ExportFailed($this->exportId));
    }
}
```

```php
// Global hook for cross-cutting alerting, in AppServiceProvider::boot():
Queue::failing(function (JobFailed $event): void {
    Log::error('queue.job_failed', [
        'connection' => $event->connectionName,
        'job' => $event->job->resolveName(),
        'exception' => $event->exception->getMessage(),
    ]);
});
```

Alert on failed-job count, not just on a dashboard nobody opens. Retry with `php artisan queue:retry` once the cause is fixed.

---

## Make Every Job Handler Idempotent

Queues deliver at least once. A worker that crashes after doing the work but before acknowledging the job causes a retry — so every handler must be safe to run twice.

The techniques, in order of preference: a unique constraint the second attempt violates harmlessly, a guard on current state, or an explicit processed-marker keyed by an idempotency key.

**Incorrect (retry charges the customer twice):**

```php
final class ChargeOrder implements ShouldQueue
{
    public function handle(PaymentGateway $gateway): void
    {
        $order = Order::findOrFail($this->orderId);

        $charge = $gateway->charge($order->total, $order->paymentToken());

        $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    }
}
```

**Correct (guard on state, and give the gateway an idempotency key):**

```php
final class ChargeOrder implements ShouldQueue
{
    public function __construct(private readonly int $orderId) {}

    public function handle(PaymentGateway $gateway): void
    {
        $order = Order::findOrFail($this->orderId);

        if ($order->status !== OrderStatus::Pending) {
            return;   // already charged, or cancelled — nothing to do
        }

        $charge = $gateway->charge(
            amount: $order->total,
            token: $order->paymentToken(),
            idempotencyKey: "order-{$order->id}-charge",
        );

        $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    }
}
```

```php
// Or let the database enforce it:
UsageRecord::firstOrCreate(
    ['tenant_id' => $tenantId, 'order_id' => $orderId],   // unique index
    ['amount' => $amount],
);
```

Test it by calling `handle()` twice and asserting the same end state.

---

## Never Put a Secret in a Job Payload

A dispatched job is serialized to JSON and stored in plaintext — in Redis, or in the `jobs` table, or on SQS. If it fails it is copied into `failed_jobs` and kept until someone prunes it, and Horizon renders the payload in a browser for anyone with dashboard access. A password or API key passed to a constructor is now sitting in three places with none of the protection the `.env` had.

`#[\SensitiveParameter]` does not help here: it redacts stack traces, not serialization. Pass a reference and resolve the secret inside `handle()`, where it lives for the length of one execution.

**Incorrect (the credential is written to the queue store and survives in `failed_jobs`):**

```php
final class SyncIntegrationJob implements ShouldQueue
{
    public function __construct(
        private readonly int $integrationId,
        private readonly string $apiKey,
        private readonly string $webhookSecret,
    ) {}
}

SyncIntegrationJob::dispatch($integration->id, $integration->api_key, $integration->webhook_secret);
```

**Correct (identity in the payload, secret read at execution time):**

```php
final class SyncIntegrationJob implements ShouldQueue
{
    public function __construct(private readonly int $integrationId) {}

    public function handle(IntegrationRepositoryInterface $integrations, GatewayClientFactory $clients): void
    {
        $integration = $integrations->activeIntegration($this->integrationId);

        if ($integration === null) {
            return;
        }

        $clients->for($integration)->sync();   // decrypts the credential here, in memory
    }
}

SyncIntegrationJob::dispatch($integration->id);
```

The same applies to `Notification` and `Mailable` constructors — both are serialized when queued. Store credentials encrypted (`encrypted` cast, or a secrets manager) and read them through the repository that owns them. See `rules/job-serialize-ids-not-models.md` for the non-secret version of this rule.

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

---

## Rate Limit Jobs That Call an External API

Ten workers draining a backlog will hit a third-party API as fast as the network allows. The provider answers with 429s, every job fails, all of them retry, and the retries produce the same burst. Backoff on the job does not help — the limit is global, not per job.

Define the limiter once and apply it as job middleware, which releases the job back to the queue instead of consuming an attempt.

**Incorrect (concurrency decided by how many workers happen to be running):**

```php
final class SyncContactToCrm implements ShouldQueue
{
    public int $tries = 5;
    public array $backoff = [10, 30, 60];

    public function handle(CrmClient $crm): void
    {
        $crm->upsert($this->contactId);   // 429 as soon as the queue has depth
    }
}
```

**Correct:**

```php
// AppServiceProvider::boot()
RateLimiter::for('crm', fn () => Limit::perMinute(60));
```

```php
final class SyncContactToCrm implements ShouldQueue
{
    public int $tries = 5;

    /** @return list<object> */
    public function middleware(): array
    {
        return [(new RateLimited('crm'))->dontRelease()];
    }
}
```

`RateLimited` releases the job with a delay by default, so a throttled job returns to the queue rather than burning an attempt. `dontRelease()` is for the case where you would rather the job wait in the worker than churn the queue.

For a limit that is about not overlapping rather than not exceeding a rate, use `WithoutOverlapping` keyed by the resource.

---

## Set Tries, Backoff and Timeout on Every Job

The defaults are wrong for most jobs. Unlimited tries turn a permanently failing job into an infinite loop that starves the queue. No backoff hammers an upstream that is already struggling. No timeout lets one hung HTTP call occupy a worker forever.

Set all three explicitly, with exponential backoff for anything that talks to a network.

**Incorrect (retries immediately and forever against a rate-limited API):**

```php
final class SyncToUpstream implements ShouldQueue
{
    public function handle(): void
    {
        Http::post('https://upstream.test/sync', $this->payload);
    }
}
```

**Correct:**

```php
final class SyncToUpstream implements ShouldQueue
{
    public int $tries = 5;
    public int $timeout = 30;
    public int $maxExceptions = 3;

    /** Exponential backoff with a ceiling: 10s, 30s, 2m, 5m, 10m. */
    public function backoff(): array
    {
        return [10, 30, 120, 300, 600];
    }

    /** Stop retrying after this instant regardless of attempts left. */
    public function retryUntil(): DateTimeInterface
    {
        return now()->addHours(6);
    }
}
```

**Laravel 13 — the same thing as attributes:**

```php
use Illuminate\Queue\Attributes\{Backoff, FailOnTimeout, Timeout, Tries};

#[Tries(5)]
#[Backoff([10, 30, 120, 300, 600])]
#[Timeout(30)]
#[FailOnTimeout]
final class SyncToUpstream implements ShouldQueue
{
    // ...
}
```

Add jitter when many jobs retry together, or they synchronize into a thundering herd.

A time-boxed job uses `retryUntil()` instead of a count — and must set `$tries = 0`, or the attempt limit fires before the deadline does:

```php
public int $tries = 0;

public function retryUntil(): DateTimeInterface
{
    return now()->addHours(4);
}
```

---

## Keep retry_after Longer Than Any Job's Timeout

`retry_after` on the queue connection is how long the worker waits before deciding a reserved job died and releasing it back to the queue. If a job is still running when that timer expires, a second worker picks it up — two copies of the same charge, the same export, the same email.

The rule is one line: `retry_after` must exceed the longest `timeout` of any job on that connection, plus its startup cost.

**Incorrect (a two-minute job on a ninety-second lease):**

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 120;
}
```

```php
// config/queue.php
'redis' => [
    'driver' => 'redis',
    'retry_after' => 90,      // job is re-dispatched while the first copy is still working
],
```

**Correct:**

```php
// config/queue.php — one connection per timeout class
'redis' => [
    'driver' => 'redis',
    'queue' => 'default',
    'retry_after' => 180,
],

'redis-long' => [
    'driver' => 'redis',
    'queue' => 'reports',
    'retry_after' => 3600,    // exports may legitimately run for 45 minutes
],
```

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 120;
    public string $connection = 'redis';
}
```

Horizon's `timeout` supervisor setting must be lower than `retry_after` for the same reason. Idempotent handlers are the backstop when this is wrong — see `rules/job-idempotent-handlers.md` — but the configuration is the fix.

---

## Pass Identifiers, Not Object Graphs

`SerializesModels` stores the key and re-fetches on handle, which is right — but a job constructed with an eagerly-loaded model still serializes the loaded relations into the payload, and a job constructed with a plain array or collection serializes the whole graph.

Pass the identity. Re-fetch what you need inside `handle()`, where the data is current.

**Incorrect (a 400 KB payload carrying data that is stale by the time it runs):**

```php
final class SendOrderConfirmation implements ShouldQueue
{
    public function __construct(
        private readonly Order $order,          // with items, customer, merchant loaded
        private readonly Collection $items,
    ) {}
}
```

**Correct:**

```php
final class SendOrderConfirmation implements ShouldQueue
{
    public function __construct(private readonly int $orderId) {}

    public function handle(OrderRepositoryInterface $orders): void
    {
        $order = $orders->withDetail($this->orderId);   // the repository owns the eager loads

        if ($order === null) {
            return;   // deleted between dispatch and handling — not an error
        }

        Mail::to($order->customer->email)->send(new OrderConfirmation($order));
    }
}
```

Credentials are the strict version of the same rule: they never enter a payload at all, whatever their size — see `rules/job-never-serialize-secrets.md`.

Always handle the missing-row case. Between dispatch and execution the record can be deleted, and `findOrFail()` there means a failed job for something that is not a failure. Alternatively add `#[DeleteWhenMissingModels]` (or `public bool $deleteWhenMissingModels = true`).

---

## Make Jobs Unique When Duplicates Are Wasteful or Wrong

A webhook that fires five times, or a model observer on a busy row, dispatches the same job five times. `ShouldBeUnique` keeps one queued at a time for a given key; `ShouldBeUniqueUntilProcessing` releases the lock when the job starts rather than when it finishes.

Uniqueness is not idempotency — it reduces duplicates but does not eliminate them. You still need `rules/job-idempotent-handlers.md`.

**Incorrect (five identical rebuilds queued, four of them wasted):**

```php
final class RebuildSearchIndex implements ShouldQueue
{
    public function __construct(private readonly int $merchantId) {}
}
```

**Correct:**

```php
final class RebuildSearchIndex implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 300;   // lock expires after 5 minutes, in case of a crash

    public function __construct(private readonly int $merchantId) {}

    public function uniqueId(): string
    {
        return (string) $this->merchantId;
    }
}
```

```php
// Release the lock as soon as processing starts, so a change made during
// the run still queues a follow-up:
final class RebuildSearchIndex implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    // ...
}
```

Uniqueness requires a cache driver with atomic locks — Redis, Memcached, DynamoDB or a database store. The `array` and `file` drivers will not do it correctly across processes.

`ShouldBeUnique` holds the lock until the job finishes, so a change made while it runs is dropped. `ShouldBeUniqueUntilProcessing` releases the lock as processing starts, which is what you want for a job that rebuilds current state — a search-index or cache refresh.

---

# 2. Domain Events

**Impact: HIGH**

Side effects are announced, not performed inline. The producer dispatches a past-tense event carrying identities; each consumer reacts in its own domain.

---

## Events Carry Identities, Not Models

A queued listener receives a serialized event. Putting an Eloquent Model in it serializes whatever relations happen to be loaded, hands another domain your model, and delivers data that is already stale by the time the listener runs.

Carry identities and small Value Objects. The listener fetches what it needs, from its own side.

**Incorrect (an aggregate crosses the boundary, with its object graph):**

```php
final readonly class OrderPlaced
{
    public function __construct(public Order $order) {}   // items, customer, merchant
}

// Billing now depends on App\Domain\Orders\Models\Order — a forbidden import.
```

**Correct:**

```php
final readonly class OrderPlaced
{
    public function __construct(
        public TenantId $tenantId,
        public OrderId $orderId,
        public Money $total,          // shared-kernel value object, safe to carry
    ) {}
}
```

```php
final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);   // a DTO

        UsageRecord::create([
            'tenant_id' => $event->tenantId->value,
            'amount' => $summary->total->minorUnits,
        ]);
    }
}
```

Include a field in the event only when every consumer needs it and it will not go stale. Otherwise let the consumer ask.

---

## Dispatch Events After the Transaction Commits

An event dispatched inside a transaction can reach a queued listener before the transaction commits. The listener queries for a row that does not exist yet — or that never will, if the transaction rolls back. The failure rate scales with load, which makes it easy to dismiss as flakiness.

**Incorrect:**

```php
DB::transaction(function () use ($data): void {
    $order = $this->orders->place($data);

    OrderPlaced::dispatch($order->tenantId(), $order->id());   // races the COMMIT
});
```

**Correct (dispatch outside the transaction):**

```php
$order = DB::transaction(fn (): Order => $this->orders->place($data));

OrderPlaced::dispatch($order->tenantId(), $order->id());
```

**Correct (when it must be inside, defer explicitly):**

```php
DB::transaction(function () use ($data): void {
    $order = $this->orders->place($data);

    // Per dispatch — chain it onto anything queueable:
    GenerateInvoice::dispatch($order->id())->afterCommit();

    // Or defer an arbitrary callback:
    DB::afterCommit(fn () => OrderPlaced::dispatch($order->tenantId(), $order->id()));
});
```

**Or globally, on the queue connection:**

```php
// config/queue.php
'redis' => [
    // ...
    'after_commit' => true,
],
```

`after_commit` covers queued jobs, queued event listeners, mailables, notifications and broadcast events, and a rollback discards everything dispatched inside the transaction. It does not defer synchronous listeners — one more reason side-effecting listeners are queued. With it on globally, a dispatch that genuinely must not wait opts out with `->beforeCommit()`.

Per-event rather than per-connection, an event class may implement `Illuminate\Contracts\Events\ShouldDispatchAfterCommit` — the same guarantee, declared where the event is defined. Notifications and mailables use `afterCommit()`; see `rules/event-queue-notifications-and-mailables.md`.

---

## Announce State Changes, Do Not Perform Side Effects Inline

When a use case completes, the Action dispatches a past-tense Domain Event. Emails, analytics, cache invalidation, downstream syncs and metering are listeners.

The test: adding a new reaction should not require editing the Action.

**Incorrect (the Action grows a line per consumer, forever):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = $this->orders->place($data);

        Mail::to($order->customer)->send(new OrderConfirmation($order));
        UsageRecord::create(['tenant_id' => $order->tenant_id, 'amount' => $order->total]);
        Http::post(config('analytics.url'), ['event' => 'order_placed']);
        Cache::tags(['orders'])->flush();
        $this->search->index($order);

        return $order;
    }
}
```

**Correct:**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = DB::transaction(fn (): Order => $this->orders->place($data));

        OrderPlaced::dispatch($order->tenantId(), $order->id());

        return $order;
    }
}
```

```php
// Each consumer registers its own listener, in its own domain:
// Domain/Notifications/Listeners/SendOrderConfirmation.php
// Domain/Billing/Listeners/RecordOrderUsage.php
// Domain/Search/Listeners/IndexOrder.php
```

Keep effects that are part of the use case's own invariants inside the Action — reserving stock is not a reaction, it is the use case.

---

## A Listener Touches Only Its Own Domain

Listeners live with the **consumer**, in `Domain/<Context>/Listeners/`, and use only that domain's Repositories and Actions. A listener that reaches into the producer's Models has moved the coupling rather than removed it.

Registration follows the same rule: the consumer registers its own listeners.

**Incorrect (Billing's listener queries Orders' tables):**

```php
namespace App\Domain\Billing\Listeners;

use App\Domain\Orders\Models\Order;       // forbidden cross-domain import

final class RecordOrderUsage
{
    public function handle(OrderPlaced $event): void
    {
        $order = Order::with('items')->find($event->orderId->value);

        UsageRecord::create(['amount' => $order->items->sum('total')]);
    }
}
```

**Correct:**

```php
namespace App\Domain\Billing\Listeners;

use App\Domain\Orders\Contracts\OrderIntegrationInterface;   // public surface
use App\Domain\Orders\Events\OrderPlaced;                    // public surface

final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(
        private OrderIntegrationInterface $orders,
        private RecordUsageAction $recordUsage,
    ) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);

        $this->recordUsage->handle($event->tenantId, $summary->total);
    }
}
```

A domain's `Events/` and `Contracts/` are public. Its `Models/`, `Repositories/` and `Queries/` are not — see the `laravel-patterns` skill.

---

## Events Are Immutable and Past Tense

An event records something that already happened, so its name is past tense and its data cannot change. A present-tense or imperative name — `SendOrderEmail`, `ProcessOrder` — is a command wearing an event's clothes, and it couples the producer to one consumer.

Shape: `final readonly`, public promoted properties, no methods that mutate.

**Incorrect (a command named as an event, with mutable state):**

```php
class SendOrderEmail
{
    public Order $order;
    public bool $handled = false;    // listeners mutate shared state

    public function __construct(Order $order) { $this->order = $order; }
}
```

**Correct:**

```php
namespace App\Domain\Orders\Events;

final readonly class OrderPlaced
{
    public function __construct(
        public TenantId $tenantId,
        public OrderId $orderId,
        public CarbonImmutable $placedAt,
    ) {}
}
```

Good names: `OrderPlaced`, `OrderCancelled`, `PaymentCaptured`, `ConversationCompleted`, `UsageThresholdReached`.
Bad names: `OrderEvent`, `ProcessOrder`, `SendReceipt`, `OrderHandler`, `UpdateInventory`.

If you find yourself wanting a listener to return a value to the producer, you wanted a synchronous call — see the `laravel-patterns` skill on Open Host Services.

---

## Queue Notifications and Mailables, and Send Them After Commit

A `Notification` or `Mailable` without `ShouldQueue` is delivered inline: the user's request waits for SMTP, Slack or a push provider, and a provider outage becomes a 500 on an action that otherwise succeeded.

Put `ShouldQueue` on the class rather than remembering `Mail::queue()` at each call site — `Mail::send()` and `$user->notify()` then queue it everywhere, including the call sites added later.

Queued delivery inside a transaction has the same race as a job: the worker can pick it up before the commit and read a row that does not exist yet.

**Incorrect (inline delivery, and a mail that goes out for a write that rolls back):**

```php
final class InvoicePaid extends Notification
{
    // no ShouldQueue — the HTTP request pays for the SMTP round trip
}

DB::transaction(function () use ($invoice) {
    $invoice->markPaid();
    $invoice->customer->notify(new InvoicePaid($invoice->id));
});
```

**Correct:**

```php
final class InvoicePaid extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly int $invoiceId)
    {
        $this->afterCommit();
    }
}
```

```php
// Same for a Mailable:
final class StatementReady extends Mailable implements ShouldQueue
{
    use Queueable;
}
```

`afterCommit()` in the constructor covers every call site; `after_commit => true` on the queue connection covers the whole application. Route heavy channels to their own queue with `viaQueues()` so a slow provider cannot delay everything else. See `rules/event-dispatch-after-commit.md`.

---

## Queue Side-Effecting Listeners

A synchronous listener runs inside the producer's request. A slow one adds its latency to the response; a failing one throws into the Action that dispatched the event, potentially rolling back a transaction that had nothing to do with it.

Anything with a side effect — mail, HTTP, file writes, cross-domain writes — implements `ShouldQueue`. Pure in-memory projections may stay inline.

**Incorrect (the order fails because the analytics endpoint is down):**

```php
final class TrackOrderPlaced
{
    public function handle(OrderPlaced $event): void
    {
        Http::post(config('analytics.url'), ['order' => $event->orderId->value]);
    }
}
```

**Correct:**

```php
final class TrackOrderPlaced implements ShouldQueue
{
    public string $queue = 'low';
    public int $tries = 3;

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(OrderPlaced $event): void
    {
        Http::timeout(5)->post(config('analytics.url'), ['order' => $event->orderId->value]);
    }

    public function failed(OrderPlaced $event, Throwable $e): void
    {
        report($e);   // analytics loss is acceptable; silence is not
    }
}
```

A queued listener runs more than once, so `rules/job-idempotent-handlers.md` applies to it exactly as it does to a job.

---

# 3. Queue Operations

**Impact: HIGH**

Queues need separation by priority, a plan for failures, and workers that actually restart on deploy. The defaults are for development.

---

## Monitor Queue Depth, Wait Time and Failures

A queue fails quietly. Jobs pile up, latency grows, and nothing surfaces until a user reports that an email never arrived. Three signals catch almost everything: queue depth, oldest-job wait time, and failed-job rate.

**Incorrect (no visibility, discovered by a support ticket):**

```bash
php artisan queue:work redis
# Nothing watches it.
```

**Correct (Horizon thresholds, plus an external check):**

```php
// config/horizon.php
'waits' => [
    'redis:high' => 30,       // alert if a high-priority job waits over 30s
    'redis:default' => 300,
    'redis:low' => 3600,
],
```

```php
// A health endpoint your monitor can poll
final class QueueHealthController
{
    public function __invoke(): JsonResponse
    {
        $depth = Queue::size('high');
        $failed = app(FailedJobProviderInterface::class)->count();

        return response()->json(
            ['queue_depth' => $depth, 'failed_jobs' => $failed],
            $depth > 1000 || $failed > 50 ? 503 : 200,
        );
    }
}
```

```php
// Structured log on every failure, for alerting rules:
Queue::failing(fn (JobFailed $e) => Log::error('queue.job_failed', [
    'job' => $e->job->resolveName(),
    'queue' => $e->job->getQueue(),
]));
```

Laravel Pulse and Horizon both cover this; the point is that something alerts, not which tool does it.

---

## Never Run the Sync Driver in Production

`QUEUE_CONNECTION=sync` executes jobs immediately, in-process. Every `dispatch()` becomes a blocking call, `tries` and `backoff` do nothing, and a failing job throws into the request that dispatched it.

It is the right default for tests. In production it silently undoes every reason the job exists.

**Incorrect:**

```dotenv
# .env on the production host
QUEUE_CONNECTION=sync
```

**Correct:**

```dotenv
# production
QUEUE_CONNECTION=redis
```

```xml
<!-- phpunit.xml — sync is correct here -->
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
<env name="MAIL_MAILER" value="array"/>
```

```php
// Guard it at boot so a misconfigured deploy fails loudly:
public function boot(): void
{
    if ($this->app->isProduction() && config('queue.default') === 'sync') {
        throw new RuntimeException('QUEUE_CONNECTION must not be sync in production.');
    }
}
```

Prefer `Queue::fake()` in tests over relying on `sync` — it asserts *what* was dispatched without running it.

---

## Restart Workers on Every Deploy

A queue worker boots the framework once and keeps it in memory. New code deployed to disk is not picked up — the worker keeps running the old classes until it restarts, which may be never.

`php artisan queue:restart` signals every worker to exit gracefully after its current job; the process supervisor starts a fresh one.

**Incorrect (deploy script that never touches the workers):**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
# workers still running the previous release
```

**Correct:**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache

php artisan queue:restart      # after the new code and caches are in place
# Horizon: php artisan horizon:terminate
```

Two supporting habits:

- Set `--max-time` or `--max-jobs` on workers so they recycle even if a restart signal is missed.
- Keep a migration backwards-compatible for one release, since in-flight jobs from the old code run against the new schema.

---

## Route Jobs to Queues Centrally

Laravel 13 adds `Queue::route()`, which declares the connection and queue for a job class in one place. Without it, queue assignment is either a property on every job or an `onQueue()` call at every dispatch site — and the one that gets forgotten is the one that matters.

Laravel 13 only. On Laravel 12, set `public string $queue` on the job class.

**Incorrect (assignment repeated, and inconsistent):**

```php
RebuildSearchIndex::dispatch($id)->onQueue('low');
RebuildSearchIndex::dispatch($other)->onQueue('default');   // forgotten
RebuildSearchIndex::dispatch($third);                       // forgotten entirely
```

**Correct (Laravel 13):**

```php
// app/Providers/QueueServiceProvider.php
use Illuminate\Support\Facades\Queue;

public function boot(): void
{
    Queue::route(RebuildSearchIndex::class, connection: 'redis', queue: 'low');
    Queue::route(GenerateMonthlyStatement::class, connection: 'redis', queue: 'low');
    Queue::route(SendPasswordReset::class, connection: 'redis', queue: 'high');
}
```

**Correct (Laravel 12):**

```php
final class RebuildSearchIndex implements ShouldQueue
{
    public string $queue = 'low';
    public string $connection = 'redis';
}
```

An explicit `onQueue()` at a call site still wins, which is the right precedence for the occasional deliberate override.

---

## Separate Queues by Priority and Latency Budget

One default queue means a 50,000-job import sits in front of the password-reset email dispatched a second later. Split by how long a user is willing to wait, and give each queue its own worker allocation.

A workable default: `high` (user-facing, seconds), `default` (normal), `low` (bulk, minutes to hours).

**Incorrect (everything on one queue, one worker pool):**

```php
SendPasswordReset::dispatch($user);
RebuildSearchIndex::dispatch($merchant);    // 40 minutes
GenerateMonthlyStatements::dispatch();      // 200,000 jobs
```

**Correct:**

```php
SendPasswordReset::dispatch($user)->onQueue('high');
RebuildSearchIndex::dispatch($merchant)->onQueue('low');

// Or declared on the job, so no caller has to remember:
final class RebuildSearchIndex implements ShouldQueue
{
    public string $queue = 'low';
}
```

```bash
# Workers drain in the listed order per poll
php artisan queue:work redis --queue=high,default,low
```

```php
// config/horizon.php — separate pools, so 'low' cannot starve 'high'
'supervisor-high' => ['queue' => ['high'], 'maxProcesses' => 10, 'balance' => 'auto'],
'supervisor-bulk' => ['queue' => ['default', 'low'], 'maxProcesses' => 4],
```

Add a dedicated queue for anything with a distinct rate limit — a per-vendor webhook queue, for instance.

---

# 4. Caching

**Impact: HIGH**

Cache read-heavy work, key it deterministically, and invalidate it where the data changes — not on a timer you hope is short enough.

---

## Invalidate on Write, Not on a Timer

A TTL is a guess about how long stale data is tolerable. Invalidating where the data changes makes the cache correct, and leaves the TTL as a safety net for the case you missed.

Hook `created`, `updated` and `deleted` through a model observer, or — better for cross-domain data — a listener on the Domain Event.

**Incorrect (a five-minute TTL means the user does not see their own edit):**

```php
Cache::remember("merchant:{$id}:settings", 300, fn () => Setting::forMerchant($id));
// User saves settings, refreshes, sees the old values for five minutes.
```

**Correct (observer):**

```php
final class SettingObserver
{
    public function saved(Setting $setting): void
    {
        $this->forget($setting);
    }

    public function deleted(Setting $setting): void
    {
        $this->forget($setting);
    }

    private function forget(Setting $setting): void
    {
        Cache::forget("merchant:{$setting->merchant_id}:settings:v1");
    }
}
```

```php
#[ObservedBy(SettingObserver::class)]
final class Setting extends Model {}
```

Two cautions:

- Bulk `update()` and `upsert()` do **not** fire observers — invalidate explicitly after them (see the `laravel-eloquent` skill).
- For data owned by another domain, listen to that domain's event rather than observing its model.

---

## Lock Expensive Recomputation Against Stampedes

When a hot key expires, every concurrent request misses at once and all of them run the expensive query. On a busy endpoint that is a self-inflicted load spike at a predictable interval.

`Cache::lock()` lets one request rebuild while the others wait or serve stale. For a cheap approximation, `Cache::flexible()` serves the stale value and refreshes in the background.

**Incorrect (two hundred concurrent rebuilds of the same aggregate):**

```php
return Cache::remember($key, now()->addMinutes(15), fn () => $this->stats->handle($id, $period));
```

**Correct (single-flight with a lock):**

```php
public function statsFor(int $merchantId, DateRange $period): OrderStats
{
    $key = $this->key($merchantId, $period);

    if ($cached = Cache::get($key)) {
        return $cached;
    }

    return Cache::lock("{$key}:rebuild", 30)->block(5, function () use ($key, $merchantId, $period): OrderStats {
        return Cache::remember($key, now()->addMinutes(15), fn (): OrderStats =>
            OrderStats::fromRow($this->stats->handle($merchantId, $period)));
    });
}
```

**Correct (stale-while-revalidate, when slightly stale is acceptable):**

```php
return Cache::flexible($key, [300, 900], fn (): OrderStats => /* ... */);
// Fresh for 5 minutes; between 5 and 15 minutes it returns stale and
// refreshes in the background; after 15 it recomputes synchronously.
```

Locks need an atomic store — Redis, Memcached, DynamoDB or a database store. `block()` throws `LockTimeoutException`; decide whether that is a 503 or a stale read.

---

## Memoize Repeat Reads Within a Single Request

A settings lookup, a feature-flag check or a tenant record is read from three services, a middleware and two Blade components. Each read is a Redis round trip for a value that cannot change mid-request. The cache is doing its job; the number of calls is the problem.

`Cache::memo()` keeps the resolved value in memory for the rest of the request or job, and drops it as soon as something writes to that key. `once()` memoizes a computed value that never touches the cache store at all.

**Incorrect (six round trips for one value):**

```php
final readonly class BillingPolicy
{
    public function allows(string $feature): bool
    {
        $plan = Cache::get("tenant:{$this->tenantId}:plan");   // called from five places per request

        return in_array($feature, $plan['features'], true);
    }
}
```

**Correct:**

```php
$plan = Cache::memo()->get("tenant:{$this->tenantId}:plan");        // default store
$plan = Cache::memo('redis')->get("tenant:{$this->tenantId}:plan"); // a named store
```

```php
// No cache store involved — memoized for the life of the object.
public function permissions(): Collection
{
    return once(fn (): Collection => $this->roles->flatMap->permissions->unique());
}
```

`Cache::memo()` is a decorator, not a store: it still reads through to Redis once, and `put()` or `forget()` through it invalidates the in-memory copy. Available in Laravel 13 and recent 12.x releases — check your version before relying on it. Use `once()` when the value is derived rather than cached.

---

## Cache Read-Heavy Endpoints and Expensive Queries

Dashboard aggregates, reference data, permission lookups, feature flags and rendered fragments are read far more often than they change. Cache them, and put the caching in the Repository — the layer that owns data access — not in the controller.

Cache the computed result, not the Eloquent models: a serialized model graph is large and goes stale in confusing ways.

**Incorrect (caching in the controller, caching models):**

```php
public function __invoke(): View
{
    $stats = Cache::remember('stats', 3600, fn () => Order::with('items')->get());

    return view('dashboard', ['stats' => $stats]);
}
```

**Correct:**

```php
final readonly class EloquentOrderReportingRepository implements OrderReportingRepositoryInterface
{
    public function __construct(private OrderStatsQuery $stats) {}

    public function statsFor(int $merchantId, DateRange $period): OrderStats
    {
        return Cache::tags(['orders', "merchant:{$merchantId}"])->remember(
            $this->key($merchantId, $period),
            now()->addMinutes(15),
            fn (): OrderStats => OrderStats::fromRow($this->stats->handle($merchantId, $period)),
        );
    }
}
```

Choose the TTL from how stale the data may be, and pair it with event-driven invalidation (`rules/cache-invalidate-on-model-events.md`) so the TTL is a backstop, not the mechanism.

---

## Build Cache Keys Deterministically

A cache key must include every input that changes the result — tenant, user, locale, filter, version — and must be identical for identical inputs. Two failures follow from getting this wrong: a key missing the tenant serves one tenant's data to another, and a key built from an unordered array never hits.

Adopt a convention: `domain:entity:scope:hash`, with a version segment you can bump to invalidate everything.

**Incorrect (no tenant, unstable hash, unbounded length):**

```php
Cache::remember('orders', 900, fn () => $this->stats->handle($merchantId, $period));
// Every merchant reads merchant #1's numbers.

Cache::remember('orders:'.serialize($filter), 900, $callback);
// Key order depends on how the DTO was constructed → misses.
```

**Correct:**

```php
private function key(int $merchantId, DateRange $period): string
{
    $fingerprint = [
        'from' => $period->from?->toDateString(),
        'to' => $period->to?->toDateString(),
    ];

    ksort($fingerprint);

    return sprintf(
        'orders:stats:v2:merchant:%d:%s',
        $merchantId,
        md5(json_encode($fingerprint, JSON_THROW_ON_ERROR)),
    );
}
```

Bumping `v2` to `v3` invalidates every entry for that computation — the cheapest deploy-time invalidation there is. Prefix per environment (`config('cache.prefix')`) so staging and production never share a Redis instance's keyspace.

---

## Tag Related Entries So One Write Can Clear a Group

When one write invalidates many derived entries — a merchant's dashboard, its filtered lists, its export summaries — enumerating the keys is impossible because the filter combinations are unbounded. Tags let you flush the group.

Tags require a store that supports them: Redis, Memcached or DynamoDB. The `file` and `database` stores do not.

**Incorrect (guessing at the key list, and missing most of it):**

```php
Cache::forget("orders:stats:merchant:{$id}:month");
Cache::forget("orders:stats:merchant:{$id}:week");
// ...and the forty filter combinations nobody listed
```

**Correct:**

```php
Cache::tags(['orders', "merchant:{$merchantId}"])->remember(
    $this->key($merchantId, $period),
    now()->addMinutes(15),
    $callback,
);
```

```php
// One write clears everything derived from that merchant's orders:
final class OrderObserver
{
    public function saved(Order $order): void
    {
        Cache::tags(["merchant:{$order->merchant_id}"])->flush();
    }
}
```

Keep tag cardinality low. A tag per row plus a tag per merchant is fine; a tag per filter combination recreates the problem tags were meant to solve. Where tags are unavailable, use a version segment in the key and bump it instead (`rules/cache-stable-key-convention.md`).

---

## Extend a TTL Without Rewriting the Value

Laravel 13 adds `Cache::touch()`, which extends an existing entry's TTL in place. Before it, a sliding expiry meant reading the value, writing it back with a new TTL — two round trips, a larger payload, and a race between the read and the write.

Laravel 13 only. On Laravel 12, read and re-put.

**Incorrect (read, then write back a value that did not change):**

```php
if ($session = Cache::get("presence:{$userId}")) {
    Cache::put("presence:{$userId}", $session, now()->addMinutes(15));
}
```

**Correct (Laravel 13):**

```php
Cache::touch("presence:{$userId}", now()->addMinutes(15));
```

```php
// Sliding rate-limit window, keeping the counter intact:
Cache::increment($key);
Cache::touch($key, now()->addMinute());
```

Use it for sliding-expiry data — presence, activity windows, soft session state. Do not use it to keep a derived cache alive indefinitely: an entry that never expires and is never invalidated is stale data with extra steps.

---

# 5. Scheduling

**Impact: MEDIUM**

Scheduled tasks queue work rather than doing it, never overlap, and run on exactly one server.

---

## Alert When a Scheduled Task Stops Running

A failing task logs an error. A task that stops being scheduled — because the cron entry was lost in a deploy, the container has no cron, or an overlap lock was never released — produces no signal at all. Nobody notices until the monthly invoices do not go out.

Ping an external monitor on success and on failure, so silence itself is the alert.

**Incorrect (no signal either way):**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00')->onOneServer();
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())
    ->monthlyOn(1, '02:00')
    ->onOneServer()
    ->withoutOverlapping()
    ->pingOnSuccess(config('monitoring.statements_heartbeat'))
    ->pingOnFailure(config('monitoring.statements_alert'))
    ->emailOutputOnFailure(config('alerts.ops_email'));
```

```php
// Local visibility as well as external:
Schedule::command('orders:expire-abandoned')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/schedule-expire.log'));
```

Verify the schedule itself after every deploy: `php artisan schedule:list` shows the registered tasks and their next run times.

---

## Prevent Overlapping Runs

A task scheduled every five minutes that occasionally takes seven starts a second copy while the first is still running. Two copies process the same rows, double-send, and contend for the same locks — and each run makes the next one slower.

`withoutOverlapping()` takes a lock for the duration. Give it an expiry so a crashed run does not block the task forever.

**Incorrect:**

```php
Schedule::command('orders:expire-abandoned')->everyFiveMinutes();
// Run at 10:00 still going at 10:05 → two processes expiring the same orders.
```

**Correct:**

```php
Schedule::command('orders:expire-abandoned')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);       // lock expires after 10 minutes
```

```php
// For a task with a per-tenant key, lock inside the job instead:
final class ExpireAbandonedOrders implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 600;

    public function uniqueId(): string
    {
        return (string) $this->tenantId;
    }
}
```

The lock lives in the cache, so an atomic store is required — the same requirement as unique jobs. Pick an expiry longer than the worst observed run time and shorter than the interval times two.

When the work is an unbounded cursor rather than a fixed batch, bound it by time as well: `->takeUntilTimeout(now()->addMinutes(13))` on the LazyCollection ends the pass before the next tick, leaving the remainder for the following run.

---

## A Scheduled Task Queues Work, It Does Not Do It

The scheduler runs every minute in a single process. Work performed inline blocks the next tick, has no retry, and vanishes if the process is killed mid-run.

The scheduled entry should decide *what* needs doing and dispatch jobs. The jobs do the work, with the retry and failure handling jobs already have.

**Incorrect (an hour of work inside the scheduler, no retries):**

```php
Schedule::call(function (): void {
    foreach (Merchant::all() as $merchant) {
        $rows = $this->reports->monthly($merchant->id);
        (new FastExcel($rows))->export(storage_path("statements/{$merchant->id}.xlsx"));
        Mail::to($merchant->email)->send(new StatementReady());
    }
})->monthlyOn(1, '02:00');
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00');
```

```php
final class DispatchMonthlyStatements implements ShouldQueue
{
    public function handle(MerchantRepositoryInterface $merchants): void
    {
        // The repository streams ids; the batching rule lives with the query.
        $merchants->streamStatementRecipients()
            ->each(fn (int $id) => GenerateMonthlyStatement::dispatch($id)->onQueue('low'));
    }
}
```

The job dispatches; it does not build the query. The `where` and the `lazyById(500)` belong in a Query Class behind the repository — see the `laravel-patterns` skill's `query-owns-all-query-construction` rule.

`Schedule::command()` is fine for genuinely short tasks — a cleanup, a health ping. The dividing line is whether losing the run mid-way matters.

---

## Run Each Scheduled Task on Exactly One Server

With the scheduler cron installed on three application servers, every task fires three times. Three statement runs, three emails, three sets of expired orders.

`onOneServer()` uses an atomic cache lock so only the first server to claim the minute runs the task.

**Incorrect (the same task on every node):**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00');
// Three servers → three runs → three statements per merchant.
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())
    ->monthlyOn(1, '02:00')
    ->onOneServer()
    ->withoutOverlapping();
```

Requirements and caveats:

- A shared atomic cache store — Redis, Memcached, DynamoDB or database. A per-server `file` store gives every server its own lock, which defeats the purpose.
- All servers must share the same `config('cache.prefix')`, or the locks live in different keyspaces.
- Named closures need `->name('...')` so the lock key is stable across servers.

The alternative — running the cron on only one designated node — creates a single point of failure. Prefer the lock.

Shared settings belong on a group rather than repeated per entry — one place to change, and no task that quietly missed the flag:

```php
Schedule::daily()->onOneServer()->timezone('Europe/London')->group(function (): void {
    Schedule::job(new PruneExports)->name('prune-exports');
    Schedule::job(new SendDigests)->name('send-digests');
});
```

---
