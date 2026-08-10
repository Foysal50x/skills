# eloquent

Eloquent and query-layer engineering rules for Laravel — eliminating N+1, choosing a pagination strategy, short atomic transactions, casts and scopes on the model, and where raw SQL is allowed. Use when writing or reviewing Eloquent models, migrations, query classes, repositories, exports or reporting queries, or when a Laravel endpoint is slow, leaking memory, or returning wrongly-typed columns.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. Query Performance

**Impact: CRITICAL**

N+1 queries and unbounded result sets are the two failures that take a Laravel app down under real traffic. Everything else on this list is smaller.

---

## Replace whereHas With a Join or Denormalized Column on Hot Paths

`whereHas()` compiles to a correlated `EXISTS` subquery. That is fine for an admin filter and expensive on a hot listing over millions of rows, especially combined with pagination's `COUNT`.

Measure first. When it is the bottleneck, the options are a join, a `whereIn` over a narrow subquery, or a denormalized column kept current by an observer.

**Incorrect (a correlated subquery per row, on the busiest endpoint):**

```php
return Order::query()
    ->whereHas('customer', fn (Builder $q) => $q->where('tier', 'enterprise'))
    ->whereHas('items.product', fn (Builder $q) => $q->where('category_id', $categoryId))
    ->paginate(25);
```

**Correct (join for the selective condition, index the join keys):**

```php
return Order::query()
    ->select('orders.*')
    ->join('customers', 'customers.id', '=', 'orders.customer_id')
    ->where('customers.tier', 'enterprise')
    ->whereIn('orders.id', fn (QueryBuilder $q) => $q
        ->select('order_id')
        ->from('order_items')
        ->join('products', 'products.id', '=', 'order_items.product_id')
        ->where('products.category_id', $categoryId))
    ->paginate(25);
```

Both versions live in the Query Class, so swapping one for the other changes one file. Add `->distinct()` or group when the join can multiply rows.

---

## Chunk or Stream Large Result Sets

`get()` loads every matching row into memory. For exports, backfills and migrations, iterate in batches instead.

- `chunkById()` / `lazyById()` — safe when the loop modifies the rows it is reading. Plain `chunk()` uses `OFFSET` and skips rows when the result set shifts underneath it.
- `cursor()` — one query, one model at a time, but the database still buffers the full result.
- `lazyById()` returns a `LazyCollection`, so `map`, `filter` and `each` work as usual.

**Incorrect (400 MB of models, and rows skipped as the update shifts the offset):**

```php
foreach (Order::where('status', 'pending')->get() as $order) {
    $order->update(['status' => 'expired']);
}

Order::where('status', 'pending')->chunk(500, function ($orders) {
    $orders->each->update(['status' => 'expired']);   // OFFSET drift skips rows
});
```

**Correct:**

```php
Order::query()
    ->where('status', OrderStatus::Pending)
    ->chunkById(500, function (Collection $orders): void {
        $orders->each->update(['status' => OrderStatus::Expired]);
    });

// Streaming an export:
return Order::query()
    ->where('status', OrderStatus::Paid)
    ->lazyById(1000)
    ->map(fn (Order $order) => [$order->number, $order->total]);
```

Wrap the iteration in a Query Class so the batching rule lives with the query.

---

## Eager-Load Every Relation the Output Touches

Any relation accessed while serializing or looping must be in the query's `with([...])`. Use `load()` only when the model is already in hand and the need is conditional.

Because query construction lives in the Query Class, the Query Class owns the eager loads — a Resource that reaches for `$order->customer` depends on `SearchOrdersQuery` having loaded it.

**Incorrect (one query, then one per row, then one per row again):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->where('status', $filter->status);
    }
}

final class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'customer' => $this->customer->name,          // +1 per order
            'items' => $this->items->count(),             // +1 per order
            'merchant' => $this->merchant->trading_name,  // +1 per order
        ];
    }
}
```

**Correct (loads and counts declared once, in the query):**

```php
return Order::query()
    ->with(['customer:id,name', 'merchant:id,trading_name'])
    ->withCount('items')
    ->where('status', $filter->status);
```

```php
'customer' => $this->customer->name,
'items' => $this->items_count,
```

Nested and conditional loads work the same way: `with(['items.product', 'shipment' => fn ($q) => $q->latest()])`.

---

## Ask exists() When You Only Need a Boolean

`exists()` stops at the first matching row. `count()` scans them all, and `get()->isNotEmpty()` hydrates them all into models first.

**Incorrect:**

```php
if (Order::where('customer_id', $id)->count() > 0) { /* ... */ }

if (Order::where('customer_id', $id)->get()->isNotEmpty()) { /* ... */ }

if ($customer->orders->count() > 0) { /* loads every order into memory */ }
```

**Correct:**

```php
if (Order::where('customer_id', $id)->exists()) { /* ... */ }

if ($customer->orders()->exists()) { /* relation query, not the collection */ }

// When you genuinely need the number, ask for the number:
$count = $customer->orders()->count();
```

The same distinction applies to `doesntExist()` versus `count() === 0`, and to `withExists()` versus `withCount()` when the output only renders a badge.

---

## Index Every Column You Filter, Join or Sort On

A Query Class that filters on `merchant_id`, `status` and `created_at` needs those columns indexed. Composite indexes are ordered: put equality columns first, the range column last, and match the order to the query.

Foreign keys created with `foreignId()->constrained()` are indexed. Columns filtered by convention — `status`, `type`, `tenant_id`, `archived_at` — usually are not.

**Incorrect (query written, index forgotten):**

```php
// Query Class
Order::query()
    ->where('merchant_id', $id)
    ->where('status', OrderStatus::Pending)
    ->where('created_at', '>=', $from)
    ->orderBy('created_at', 'desc');

// Migration
Schema::create('orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('merchant_id')->constrained();
    $table->string('status');
    $table->timestamps();
});
```

**Correct (index matches the access pattern):**

```php
Schema::create('orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('merchant_id')->constrained();
    $table->string('status')->index();
    $table->timestamps();

    // equality, equality, range/sort — in that order
    $table->index(['merchant_id', 'status', 'created_at']);
});
```

Verify with `EXPLAIN`, not by eye. An index that is never chosen is write cost with no read benefit — drop it.

---

## Turn Lazy Loading Into an Exception in Non-Production

`Model::preventLazyLoading()` throws the moment an un-eager-loaded relation is accessed. Enable it outside production and every N+1 becomes a failing test rather than a slow endpoint nobody notices.

Pair it with `preventSilentlyDiscardingAttributes()` (catches a typo'd or non-fillable key in `fill()`/`create()`) and `preventAccessingMissingAttributes()` (catches a column omitted by a narrow `select`).

**Incorrect (nothing enforces it, so it regresses every sprint):**

```php
// AppServiceProvider::boot()
public function boot(): void
{
    //
}
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::shouldBeStrict(! $this->app->isProduction());

    // Or, to keep lazy-loading fatal everywhere but only log in production:
    Model::preventLazyLoading(! $this->app->isProduction());
    Model::handleLazyLoadingViolationUsing(function (Model $model, string $relation): void {
        report(new LazyLoadingViolationException($model, $relation));
    });
}
```

`shouldBeStrict()` enables all three protections at once. Turn it on before the codebase is large.

---

## Select Only the Columns You Use

Wide tables — those with `TEXT` bodies, serialized payloads or embedding vectors — cost real memory and bandwidth per row. Narrow the `select` when the output does not need every column.

Always include the primary key and any foreign key a relation needs, or the eager load silently fails.

**Incorrect (hydrates a 40-column row, including a 60 KB JSON payload, per result):**

```php
return Order::query()->with('customer')->paginate(50);
```

**Correct:**

```php
return Order::query()
    ->select(['id', 'number', 'status', 'total', 'customer_id', 'created_at'])
    ->with('customer:id,name')     // id required for the match-up
    ->paginate(50);
```

Note the interaction with `preventAccessingMissingAttributes()`: a narrow select plus a Resource reading an unselected column now throws in development instead of returning `null` in production. That is the point.

---

# 2. Pagination

**Impact: HIGH**

Every list endpoint is paginated, and the pagination type is chosen deliberately — a `COUNT` over a large table is often more expensive than the page itself.

---

## Always Paginate List Endpoints

Never `->get()` an unbounded list to a client. A table that holds 200 rows in development holds 200,000 in production, and the endpoint that worked all year fails in one afternoon.

Cap `per_page` server-side even when the client supplies it.

**Incorrect:**

```php
public function pendingOrders(): Collection
{
    return Order::where('status', OrderStatus::Pending)->get();
}

// and, with a client-controlled limit:
->paginate($request->integer('per_page'));   // per_page=100000
```

**Correct:**

```php
public function pendingOrders(int $perPage = 25): LengthAwarePaginator
{
    return $this->pendingOrders->handle()->paginate($perPage);
}
```

```php
$perPage = min($request->integer('per_page', 25), 100);
```

An internal method that genuinely must return everything should stream instead — see `rules/perf-chunk-large-result-sets.md`.

---

## Use cursorPaginate for Deep or Fast-Growing Sets

`OFFSET 100000` makes the database read and discard 100,000 rows. Cursor pagination uses a `WHERE` on the ordering column instead, so page 5,000 costs the same as page 1. It also avoids skipped and repeated rows when the set changes between requests.

The cost: no page numbers, no jumping to an arbitrary page, and the ordering column must be unique (or paired with a unique tiebreaker).

**Incorrect (deep pages, live feed):**

```php
return Message::query()->latest()->paginate(50);   // page 2000 scans 100k rows
```

**Correct:**

```php
return Message::query()
    ->orderBy('created_at', 'desc')
    ->orderBy('id', 'desc')          // tiebreaker keeps the cursor unique
    ->cursorPaginate(50);
```

Choose by need:

| Need | Method |
|------|--------|
| Page numbers and a total count | `paginate()` |
| Prev/next only, moderate depth | `simplePaginate()` |
| Deep pagination, infinite scroll, live feeds | `cursorPaginate()` |

---

## Reserve paginate() for a Genuinely Required Count

Default to `simplePaginate()` or `cursorPaginate()`. Reach for `paginate()` when the count is part of the product — a result total, a page picker, a report header.

When the count is wanted but expensive, decouple it: return the page with a cheap paginator and expose the total separately, cached or approximate.

**Incorrect (an exact count of 12 million rows, recomputed per keystroke):**

```php
return Order::query()->where('status', $status)->paginate(25);
// Frontend renders: "About 12,481,203 results"
```

**Correct (separate the two questions):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): Paginator;

    /** Cached for 60s; the header does not need to be exact. */
    public function countMatching(OrderQueryFilter $filter): int;
}
```

```php
public function countMatching(OrderQueryFilter $filter): int
{
    return Cache::remember(
        'orders:count:'.md5(serialize($filter)),
        now()->addMinute(),
        fn () => $this->searchOrders->handle($filter)->count(),
    );
}
```

---

## Use simplePaginate When the Total Is Not Rendered

`paginate()` runs a second query — `SELECT COUNT(*)` over the full filtered set — to build the page count. On a large or heavily filtered table that count is often more expensive than the page itself. If the UI shows only "previous" and "next", you are paying for a number nobody sees.

**Incorrect (count query funding a link nobody clicks):**

```php
// The mobile feed renders "Load more" and nothing else.
return Order::query()->where('merchant_id', $id)->paginate(20);
```

**Correct:**

```php
return Order::query()->where('merchant_id', $id)->simplePaginate(20);
```

`simplePaginate()` fetches `perPage + 1` rows to decide whether a next page exists. Keep `paginate()` where the interface genuinely renders "Page 3 of 47" or a result total.

---

# 3. Transactions and Consistency

**Impact: HIGH**

Multi-step writes are atomic, transactions stay short, and side effects fire only after commit.

---

## Fire Side Effects After Commit

A job dispatched inside a transaction can be picked up by a worker before the transaction commits — the worker then queries for a row that does not exist yet, or that never will if the transaction rolls back. The failure is intermittent and load-dependent, which makes it expensive to diagnose.

Two fixes, both correct: set `after_commit` on the queue connection, or use `DB::afterCommit()` / `->afterCommit()` per dispatch.

**Incorrect (worker races the commit):**

```php
DB::transaction(function () use ($data): void {
    $order = Order::create($data);
    ProcessOrder::dispatch($order->id);           // may run before COMMIT
    OrderPlaced::dispatch($order->id);
});
```

**Correct (global setting):**

```php
// config/queue.php
'redis' => [
    // ...
    'after_commit' => true,
],
```

**Correct (explicit, per dispatch):**

```php
DB::transaction(function () use ($data): void {
    $order = Order::create($data);

    ProcessOrder::dispatch($order->id)->afterCommit();

    DB::afterCommit(fn () => OrderPlaced::dispatch($order->tenantId(), $order->id()));
});
```

Queued event listeners and queued notifications respect the same setting.

---

## Keep Transactions Short and Free of External Calls

A transaction holds locks for its whole duration. An HTTP call, a mail send or a file upload inside one holds those locks across network latency — and if the remote hangs, so does every request contending for the same rows.

Do the external work before or after. Inside the transaction, only database statements.

**Incorrect (row locks held for the length of a payment API round trip):**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Processing]);

    $charge = Http::post('https://payments.test/charge', [...])->json();   // seconds

    $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge['id']]);
    Mail::to($order->customer)->send(new Receipt($order));
});
```

**Correct (external call outside, transaction narrow, mail queued after commit):**

```php
$order->update(['status' => OrderStatus::Processing]);

$charge = $this->payments->charge($order->total, $order->paymentToken());

DB::transaction(function () use ($order, $charge): void {
    $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    $order->items()->update(['paid_at' => now()]);
});

OrderPaid::dispatch($order->tenantId(), $order->id());
```

If the external call must be atomic with the write, that is a saga or an outbox — not a longer transaction.

---

## Lock Rows You Are About to Read and Modify

Reading a value, deciding on it, then writing it back is a race: two concurrent requests both read the old value and both write. `lockForUpdate()` inside a transaction makes the second request wait.

Use `sharedLock()` when you must prevent the row changing while you read but do not intend to write it.

**Incorrect (both requests see stock 1 and both sell it):**

```php
$product = Product::find($id);

if ($product->stock < $quantity) {
    throw StockException::insufficient($product);
}

$product->update(['stock' => $product->stock - $quantity]);
```

**Correct (lock, check, write, all inside one transaction):**

```php
DB::transaction(function () use ($id, $quantity): void {
    $product = Product::query()->whereKey($id)->lockForUpdate()->firstOrFail();

    if ($product->stock < $quantity) {
        throw StockException::insufficient($product);
    }

    $product->decrement('stock', $quantity);
});
```

An atomic `decrement()` alone is safe against lost updates but cannot enforce the "never below zero" check — that needs the lock, or a database constraint.

---

## Let Transactions Retry on Deadlock

Deadlocks are normal under concurrency — two transactions grab the same rows in different orders and the database kills one. `DB::transaction()` accepts an attempt count and retries the whole closure when that happens.

The closure must be safe to re-run: no external calls, no accumulating state, no dispatching inside it.

**Incorrect (a single attempt, so a routine deadlock surfaces as a 500):**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->merchant->increment('balance', $order->total);
});
```

**Correct:**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->merchant->increment('balance', $order->total);
}, attempts: 3);
```

Two things reduce deadlocks more than retrying does: acquiring locks in a consistent order across all code paths, and keeping transactions short (`rules/tx-keep-transactions-short.md`).

---

## Wrap Multi-Step Writes in a Transaction

When one logical change touches more than one row or table, it belongs in `DB::transaction()`. Without it, a failure between statements leaves the database in a state your invariants say is impossible.

`DB::transaction(callable)` commits on return and rolls back on any thrown exception — prefer it over manual `beginTransaction`/`commit`/`rollBack`, which leaks an open transaction on an early return.

**Incorrect (the order is paid, the items are not, and stock is never decremented):**

```php
$order->update(['status' => OrderStatus::Paid]);
$order->items()->update(['paid_at' => now()]);      // throws here
$this->stock->decrement($order->items);
```

**Correct:**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->items()->update(['paid_at' => now()]);
    $this->stock->decrement($order->items);
});
```

The Action owns the transaction boundary, because the Action knows the extent of the use case. A Repository method should not open one for a single statement.

---

# 4. Model Declaration

**Impact: HIGH**

Casts, fillable and attributes are declared once on the model so no caller has to remember that a column is JSON, an enum or money.

---

## Cast Every Date, Enum, JSON and Money Column

An un-cast column returns a string. Every caller then has to remember to parse it, and one that forgets compares a string to a `Carbon` or an enum and silently gets `false`.

Cast in `casts()` so the type is declared once:

- Enums → the enum class
- Dates → `datetime` or `immutable_datetime`
- JSON → `array`, `collection` or `AsArrayObject`
- Money and other Value Objects → a custom `CastsAttributes` class
- Encrypted columns → `encrypted`, `encrypted:array`

**Incorrect (three call sites, three different interpretations):**

```php
final class Order extends Model
{
    // no casts
}

$order->status === OrderStatus::Paid;        // false — string vs enum
$order->expires_at->isPast();                // Error: method on string
$order->metadata['channel'];                 // Error: string offset
```

**Correct:**

```php
final class Order extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'expires_at' => 'immutable_datetime',
            'metadata' => AsArrayObject::class,
            'total' => MoneyCast::class,
            'settings' => 'encrypted:array',
        ];
    }
}
```

Prefer `immutable_datetime` — a mutable `Carbon` shared between two variables produces action-at-a-distance bugs when one of them calls `addDay()`.

---

## Give Value Objects a Custom Cast

When a column represents a Value Object — money with a currency, a coordinate pair, an encrypted token — implement `CastsAttributes` so the model returns the domain type directly. Otherwise every caller reconstructs it, and one of them will get it wrong.

The cast belongs with the domain: `app/Domain/<Context>/Casts/`, or `app/Support/Casts/` when the Value Object is in the Shared Kernel.

**Incorrect (reassembled at every read):**

```php
$total = new Money($order->total_minor, $order->currency);       // in the Resource
$total = new Money($order->total_minor, $order->currency);       // in the invoice PDF
$total = Money::of($order->total_minor / 100, $order->currency); // and here, wrongly
```

**Correct:**

```php
namespace App\Support\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

/** @implements CastsAttributes<Money, Money> */
final class MoneyCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Money
    {
        return $value === null ? null : new Money((int) $value, $attributes['currency'] ?? 'USD');
    }

    /** @return array<string, mixed> */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if (! $value instanceof Money) {
            throw new InvalidArgumentException('total must be a Money instance.');
        }

        return ['total' => $value->minorUnits, 'currency' => $value->currency];
    }
}
```

```php
protected function casts(): array
{
    return ['total' => MoneyCast::class];
}

$order->total->plus($shipping);   // a Money, everywhere
```

---

## Type Models Fully and Mark Them final

Use the PHP features the project's version supports: native return types on relations, typed properties, `final` on classes with no intended subclass, `declare(strict_types=1)` at the top of every file.

Annotate model properties with `@property` so static analysis and the IDE know what `$order->status` is. Laravel IDE helper generates these; committing them is the point.

**Incorrect (untyped, extendable, invisible to analysis):**

```php
class Order extends Model
{
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
```

**Correct:**

```php
<?php

declare(strict_types=1);

namespace App\Domain\Orders\Models;

/**
 * @property int $id
 * @property string $number
 * @property OrderStatus $status
 * @property Money $total
 * @property CarbonImmutable $created_at
 * @property-read Customer $customer
 */
final class Order extends Model
{
    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
```

`final` is the right default for domain models. Drop it only when a subclass genuinely exists — single-table inheritance, or a test double that cannot be built another way.

---

## Store UTC, Cast Immutable, Convert at the Edge

Keep `config('app.timezone')` at `UTC` so every stored timestamp means the same thing. Convert to the user's timezone only when rendering, and back to UTC when accepting input.

Cast dates as `immutable_datetime`. A mutable `Carbon` mutates in place, so `$range->from->addDay()` silently changes the range every other holder of that object can see.

**Incorrect (local timezone stored, mutable date mutated in place):**

```php
// config/app.php
'timezone' => 'Asia/Dhaka',      // now half the rows mean something else

$end = $order->created_at;
$deadline = $end->addDays(7);    // $order->created_at just moved too
```

**Correct:**

```php
// config/app.php
'timezone' => 'UTC',
```

```php
protected function casts(): array
{
    return ['created_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime'];
}

$deadline = $order->created_at->addDays(7);   // returns a new instance
```

```php
// Edge: accept the user's local day boundaries, store UTC
$from = CarbonImmutable::parse($request->string('from'), $user->timezone)
    ->startOfDay()
    ->utc();
```

A "today" filter computed in UTC for a user in UTC+6 covers the wrong six hours. Resolve the range at the edge and pass a `DateRange` inward.

---

## Keep fillable and hidden Minimal and Intentional

`$fillable` is a security boundary. A wide list — or `$guarded = []` — lets any request body write `is_admin`, `tenant_id`, `status` or `balance` if a caller ever passes unvalidated input to `create()` or `update()`.

List only the attributes a client may set. Anything decided by the system is assigned explicitly.

**Incorrect:**

```php
final class User extends Model
{
    protected $guarded = [];        // everything is fillable
}

User::create($request->all());      // is_admin=1 works
```

**Correct:**

```php
final class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret'];
}
```

```php
$user = User::create($request->validated());   // validated keys only
$user->forceFill(['tenant_id' => $tenant->id])->save();   // system-decided, explicit
```

Enable `Model::preventSilentlyDiscardingAttributes()` so a non-fillable key throws in development instead of being dropped — see `rules/perf-prevent-lazy-loading.md`.

---

## Attach Observers With the ObservedBy Attribute

Registering observers in a service provider hides them: reading the model tells you nothing about what fires on save. `#[ObservedBy]` puts the registration on the model, where anyone editing it will see it.

**Incorrect (registration far from the model):**

```php
// AppServiceProvider::boot() — 40 lines of unrelated bootstrapping
Order::observe(OrderObserver::class);
Order::observe(AuditObserver::class);
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Attributes\ObservedBy;

#[ObservedBy([OrderObserver::class, AuditObserver::class])]
final class Order extends Model
{
    // ...
}
```

Two cautions that do not change with the attribute:

- Observers do not fire on bulk `update()`, `delete()` or `upsert()` — see `rules/bulk-update-bypasses-events.md`.
- Keep observers to bookkeeping (slugs, audit rows, cache invalidation). Business workflows belong in Actions, announced by Domain Events.

---

## Declare Query Scopes With the Scope Attribute

Laravel 12 added `#[Scope]`, which removes the `scope` name prefix and makes the intent explicit. Static analysis and IDEs resolve it; the old prefix convention they had to special-case.

Available on Laravel 12 and 13. On Laravel 11 use the `scope` prefix.

**Incorrect (prefix convention, and a redundant one at that):**

```php
final class Project extends Model
{
    public function scopeOwnedBy(Builder $query, int $userId): Builder
    {
        return $query->where('owner_id', $userId);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }
}
```

**Correct (Laravel 12+):**

```php
use Illuminate\Database\Eloquent\Attributes\Scope;

final class Project extends Model
{
    #[Scope]
    protected function ownedBy(Builder $query, int $userId): void
    {
        $query->where('owner_id', $userId);
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull('archived_at');
    }
}

Project::query()->ownedBy($user->id)->active()->get();
```

Scopes are called from Query Classes and Repository implementations, which is where query construction lives.

---

# 5. Scopes, Global Scopes and Soft Deletes

**Impact: MEDIUM-HIGH**

Reusable constraints belong on the model as scopes. Choose a global scope or a named scope for a given filter — not both.

---

## Be Explicit When Querying Trashed Rows

`withTrashed()` and `onlyTrashed()` change what a query means. Put them in the Query Class, name the query accordingly, and never scatter them through Actions or controllers.

A restore flow needs `withTrashed()`; an audit report needs `onlyTrashed()`; everything else needs neither.

**Incorrect (opt-out sprinkled at the call site, intent unclear):**

```php
$order = Order::withTrashed()->find($id);         // in a controller — why?
$orders = Order::withTrashed()->where(...)->get(); // and here
```

**Correct (the query name says what it includes):**

```php
final readonly class RestorableOrderQuery
{
    public function handle(int $id): ?Order
    {
        return Order::query()->withTrashed()->find($id);
    }
}

final readonly class DeletedOrdersForAuditQuery
{
    public function handle(DateRange $period): Builder
    {
        return Order::query()->onlyTrashed()->whereBetween('deleted_at', [$period->from, $period->to]);
    }
}
```

```php
// Repository exposes the intent:
$orders->restorableOrder($id);
$orders->deletedForAudit($period);
```

Note that `restore()` fires `restoring`/`restored` events, while `forceDelete()` is permanent and skips nothing — treat it as a separate, authorized operation.

---

## One Filter, One Mechanism

For a given filter, use a global scope **or** a named scope — not both, unless layered behavior is genuinely intended and documented. Defining the same predicate twice means a reader cannot tell whether calling the named scope adds a constraint or repeats one, and removing the global scope silently changes what the named scope means.

**Incorrect (the same predicate in two mechanisms):**

```php
final class Project extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('active', fn (Builder $q) => $q->whereNull('archived_at'));
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull('archived_at');    // already applied — no-op, or is it?
    }
}
```

**Correct (global scope owns the default; the named scope is the escape hatch):**

```php
final class Project extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('active', fn (Builder $q) => $q->whereNull('archived_at'));
    }

    /** Deliberate layering: include archived rows, documented as such. */
    #[Scope]
    protected function includingArchived(Builder $query): void
    {
        $query->withoutGlobalScope('active');
    }
}
```

If callers frequently need the unfiltered set, that is evidence the filter should not have been global.

---

## Use a Global Scope for a Filter That Must Never Be Forgotten

Some constraints must apply to every query: the tenant boundary, soft-archive exclusion, a published flag. A named scope relies on every caller remembering. A global scope makes it the default and requires opting out explicitly.

Register it in `booted()`, or as a dedicated `Scope` class when it has real logic.

**Incorrect (one forgotten `where` leaks another tenant's data):**

```php
final class Project extends Model
{
    #[Scope]
    protected function forTenant(Builder $query): void
    {
        $query->where('tenant_id', auth()->user()->tenant_id);
    }
}

Project::forTenant()->get();       // remembered
Project::where('status', 'active')->get();   // forgotten — cross-tenant leak
```

**Correct:**

```php
final class Project extends Model
{
    use SoftDeletes;

    protected static function booted(): void
    {
        static::addGlobalScope('active', function (Builder $builder): void {
            $builder->whereNull('archived_at');
        });

        static::addGlobalScope(new TenantScope());
    }
}
```

```php
// Opt out deliberately, where it is auditable:
Project::withoutGlobalScope('active')->get();
Project::withoutGlobalScopes()->get();
```

Global scopes apply to relation queries too, so a leak in the scope leaks everywhere. Test it directly.

---

## Put Small Reusable Constraints on the Model as Scopes

A constraint that expresses a concept — active, published, overdue, owned by — belongs on the model as a named scope. Query Classes then compose those scopes, so the definition of "overdue" lives in exactly one place.

Scopes are for small constraints. A multi-filter search with sorting and eager loading is a Query Class, not a scope.

**Incorrect (the same predicate, spelled three slightly different ways):**

```php
Project::whereNull('archived_at')->where('status', 'active')->get();
Project::where('status', 'active')->whereNull('archived_at')->get();
Project::where('status', '=', 'active')->get();   // forgot the archive check
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Attributes\Scope;

final class Project extends Model
{
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('status', ProjectStatus::Active)->whereNull('archived_at');
    }

    #[Scope]
    protected function ownedBy(Builder $query, int $userId): void
    {
        $query->where('owner_id', $userId);
    }
}
```

```php
// Composed inside a Query Class:
return Project::query()->active()->ownedBy($userId)->with('members');
```

Scopes are called from Query Classes and Repository implementations — the layers where query construction lives.

---

## Use SoftDeletes Only for Genuinely Recoverable Records

`SoftDeletes` is right when a record must be restorable or retained for audit. It is wrong as a default on every table: soft-deleted rows still occupy unique indexes, still join, and still have to be excluded from every raw query and reporting job.

For "hide it from the list but keep it", a domain column like `archived_at` is often clearer — it says what happened.

**Incorrect (soft deletes everywhere, and a unique index that now blocks re-registration):**

```php
final class User extends Model
{
    use SoftDeletes;
}

Schema::table('users', fn (Blueprint $t) => $t->unique('email'));
// Deleted user keeps the row → the same email can never sign up again.
```

**Correct (scope the uniqueness, or do not soft-delete):**

```php
final class User extends Model
{
    use SoftDeletes;
}

// Postgres: unique only among live rows
DB::statement('CREATE UNIQUE INDEX users_email_active ON users (email) WHERE deleted_at IS NULL');

// MySQL: include the discriminator in the index
$table->unique(['email', 'deleted_at']);
```

```php
// Or: no soft deletes, an explicit lifecycle column
$table->timestamp('archived_at')->nullable()->index();
```

Raw SQL, `DB::table()` queries and reporting views bypass the soft-delete scope entirely — audit those separately.

---

# 6. Raw SQL and Query Expressions

**Impact: MEDIUM**

JOINs, CTEs, aggregates and raw expressions are allowed and often necessary — but only inside Query Classes and Repositories, and preferably as type-safe expressions rather than `DB::raw()`.

---

## Compute Dashboard Counters in One Query

A stats panel that runs one `count()` per tile issues one round trip per tile, each scanning the same table. Conditional aggregates collapse them into a single pass.

**Incorrect (five scans of the same table):**

```php
return [
    'pending' => Order::where('status', 'pending')->count(),
    'paid' => Order::where('status', 'paid')->count(),
    'refunded' => Order::where('status', 'refunded')->count(),
    'revenue' => Order::where('status', 'paid')->sum('total'),
    'avg_basket' => Order::where('status', 'paid')->avg('total'),
];
```

**Correct (one query, typed expressions):**

```php
final readonly class OrderStatsQuery
{
    public function handle(int $merchantId, DateRange $period): object
    {
        $paid = new Equal('status', new Value(OrderStatus::Paid->value));

        return Order::query()
            ->select([
                new Alias(new CountFilter(new Equal('status', new Value('pending'))), 'pending'),
                new Alias(new CountFilter($paid), 'paid'),
                new Alias(new CountFilter(new Equal('status', new Value('refunded'))), 'refunded'),
                new Alias(new SumFilter('total', $paid), 'revenue'),
                new Alias(new AvgFilter('total', $paid), 'avg_basket'),
            ])
            ->where('merchant_id', $merchantId)
            ->tap(fn (Builder $q) => $this->applyDateRange($q, $period, 'created_at'))
            ->toBase()
            ->first();
    }
}
```

`toBase()` skips model hydration — there is no model here, only numbers. Cache the result if the panel is hit on every page load.

---

## Wrap Driver-Specific SQL in an Expression Class

Date formatting, JSON extraction and string functions differ per driver. If tests run on SQLite and production on MySQL, inline `date_format()` passes CI and fails in production — or vice versa.

Implement `Illuminate\Contracts\Database\Query\Expression` once. Shared helpers live in `app/Support/Query/`, domain-specific ones in `Domain/<Context>/Support/Query/`. They are query construction, so they are used only inside Query Classes and Repositories.

**Incorrect (MySQL syntax, SQLite test suite):**

```php
Order::selectRaw("date_format(created_at, '%Y-%m') as month")->groupBy('month')->get();
```

**Correct:**

```php
namespace App\Support\Query;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Database\Grammar;
use Illuminate\Database\Query\Grammars\{PostgresGrammar, SQLiteGrammar, SqlServerGrammar};

final class DateFmt implements Expression
{
    public function __construct(
        private readonly string|Expression $column,
        private readonly string $format = 'Y-m',
    ) {}

    public function getValue(Grammar $grammar): string
    {
        $column = $grammar->wrap($this->column);

        return match (true) {
            $grammar instanceof SQLiteGrammar => "strftime('{$this->token('sqlite')}', {$column})",
            $grammar instanceof PostgresGrammar => "to_char({$column}, '{$this->token('pgsql')}')",
            $grammar instanceof SqlServerGrammar => "format({$column}, '{$this->token('sqlsrv')}')",
            default => "date_format({$column}, '{$this->token('mysql')}')",
        };
    }

    private function token(string $driver): string
    {
        return match ($driver) {
            'sqlite', 'mysql' => ['Y-m' => '%Y-%m', 'Y-m-d' => '%Y-%m-%d', 'Y' => '%Y'][$this->format] ?? '%Y-%m-%d',
            'pgsql' => ['Y-m' => 'YYYY-MM', 'Y-m-d' => 'YYYY-MM-DD', 'Y' => 'YYYY'][$this->format] ?? 'YYYY-MM-DD',
            'sqlsrv' => ['Y-m' => 'yyyy-MM', 'Y-m-d' => 'yyyy-MM-dd', 'Y' => 'yyyy'][$this->format] ?? 'yyyy-MM-dd',
        };
    }
}
```

```php
->select(new Alias(new DateFmt('created_at', 'Y-m'), 'month'))
->groupBy(new DateFmt('created_at', 'Y-m'))
```

The better fix, where possible, is to test against the same engine you run in production.

---

## Never Interpolate User Input Into Raw SQL

The query builder parameterizes values, but `selectRaw`, `whereRaw`, `orderByRaw`, `havingRaw` and `DB::raw()` do not — whatever string you hand them becomes SQL. Pass values as bindings, and validate identifiers against an allow-list.

Identifiers (column and table names) cannot be bound at all. That is why sortable columns are whitelisted.

**Incorrect:**

```php
Order::whereRaw("number LIKE '%{$request->input('q')}%'")->get();

Order::orderByRaw($request->input('sort').' '.$request->input('dir'))->get();

DB::select("SELECT * FROM orders WHERE merchant_id = {$merchantId}");
```

**Correct:**

```php
Order::whereRaw('number LIKE ?', ['%'.$search.'%'])->get();

// Better still — no raw needed:
Order::where('number', 'like', '%'.$search.'%')->get();
```

```php
private const SORTABLE = ['created_at', 'number', 'total'];

$column = in_array($sorting->column, self::SORTABLE, true) ? $sorting->column : 'created_at';

Order::orderBy($column, $sorting->direction->value)->get();
```

`LIKE` wildcards in user input are a smaller, related issue: escape `%` and `_` when the search should be literal.

---

## Raw SQL Belongs Inside Query Classes and Repositories

JOINs, CTEs, window functions, aggregate selects and raw expressions are allowed and often necessary — for dashboard stats, charts, or anywhere Eloquent hydration is the bottleneck. They are allowed in exactly two places: Query Classes and Repository implementations.

Never in a Controller, Action, Service, Job or Blade view.

**Incorrect (a reporting query in the controller, unnamed and untestable):**

```php
final class DashboardController
{
    public function __invoke(): View
    {
        $rows = DB::select("
            SELECT date_format(created_at, '%Y-%m') AS month, sum(total) AS revenue
            FROM orders WHERE merchant_id = ? GROUP BY month
        ", [auth()->user()->merchant_id]);

        return view('dashboard', ['rows' => $rows]);
    }
}
```

**Correct (named query class, behind the repository):**

```php
namespace App\Domain\Orders\Queries;

final readonly class MonthlyRevenueQuery
{
    public function handle(int $merchantId, DateRange $period): Collection
    {
        return Order::query()
            ->selectRaw('date_format(created_at, ?) as month, sum(total) as revenue', ['%Y-%m'])
            ->where('merchant_id', $merchantId)
            ->when($period->from !== null, fn (Builder $q) => $q->where('created_at', '>=', $period->from))
            ->groupBy('month')
            ->orderBy('month')
            ->get();
    }
}
```

```php
$rows = $reports->monthlyRevenue($merchantId, (new LastNMonths(12))->range());
```

Cross-database date formatting has a better home than `selectRaw` — see `rules/raw-custom-expression-helpers.md`.

---

## Replace DB::raw With Type-Safe Query Expressions

`tpetry/laravel-query-expressions` provides composable, driver-aware expression objects usable in `where()`, `select()`, `update()`, aggregates and schema definitions. Prefer them over `DB::raw()`: they are typed, they escape identifiers, and they compile correctly on MySQL, Postgres, SQLite and SQL Server.

Requires `^1.6` for Laravel 13 support. Still query construction, so still only inside Query Classes and Repositories.

**Incorrect (string SQL, one dialect, no escaping):**

```php
Movie::selectRaw("count(case when released = 2021 then 1 end) as released_2021")
    ->selectRaw("count(case when genre = 'Drama' then 1 end) as genre_drama")
    ->where('streamingservice', 'netflix')
    ->get();

$quota->update(['credits' => DB::raw('credits - 15')]);
```

**Correct:**

```php
use Tpetry\QueryExpressions\Function\Aggregate\CountFilter;
use Tpetry\QueryExpressions\Operator\Comparison\Equal;
use Tpetry\QueryExpressions\Operator\Arithmetic\Subtract;
use Tpetry\QueryExpressions\Language\{Alias, Value};

Movie::select([
    new Alias(new CountFilter(new Equal('released', new Value(2021))), 'released_2021'),
    new Alias(new CountFilter(new Equal('genre', new Value('Drama'))), 'genre_drama'),
])->where('streamingservice', 'netflix')->get();

$quota->update(['credits' => new Subtract('credits', new Value(15))]);
```

Available groups: value/wrap (`Value`, `Alias`), CASE (`CaseGroup`, `CaseRule`), arithmetic (`Add`, `Subtract`, `Multiply`, `Divide`, `Modulo`, `Power`), comparison (`Equal`, `GreaterThan`, `Between`, `IsNull`, …), logical (`CondAnd`, `CondOr`, `CondNot`), bitwise, aggregates (`Count`, `CountFilter`, `Sum`, `SumFilter`, `Avg`, `Min`, `Max`), conditional (`Coalesce`, `Greatest`, `Least`), string (`Concat`, `Lower`, `Upper`, `Uuid4`), time (`Now`, `ExtractDatePart`, `TimestampBin`), math (`Abs`).

---

# 7. Bulk Operations

**Impact: MEDIUM**

Loops that write one row at a time are the slowest thing in most import and sync jobs. Bulk operations trade model events for orders of magnitude.

---

## Iterate Huge Sets With lazyById, Not Offsets

`chunk()` and `lazy()` page with `LIMIT`/`OFFSET`. If the loop modifies the rows it is reading — the common case in a backfill — the result set shifts and later pages skip records.

`chunkById()` and `lazyById()` page on the primary key instead, so the cursor stays correct no matter what the loop writes.

**Incorrect (each processed batch drops out of the filter, shifting the offset):**

```php
User::where('needs_backfill', true)->chunk(500, function (Collection $users): void {
    $users->each->update(['needs_backfill' => false]);   // silently skips ~half
});
```

**Correct:**

```php
User::query()
    ->where('needs_backfill', true)
    ->chunkById(500, function (Collection $users): void {
        $users->each->update(['needs_backfill' => false]);
    });
```

```php
// LazyCollection when you want collection semantics over the stream:
User::query()
    ->where('needs_backfill', true)
    ->lazyById(500)
    ->each(fn (User $user) => BackfillUser::dispatch($user->id));
```

For a non-integer or non-sequential key, use `chunkById(500, $callback, column: 'uuid', alias: 'uuid')` and make sure that column is indexed and ordered.

---

## Bulk Writes Skip Model Events — Handle That Deliberately

`Model::query()->update()`, `->delete()`, `insert()` and `upsert()` run one SQL statement without hydrating models. No `saving`, `saved`, `updating`, `updated`, `deleting` or `deleted` event fires, so observers, audit trails and cache invalidation do not run.

That is usually the point — it is why the bulk write is fast. Make the decision explicit and cover the side effects yourself.

**Incorrect (cache never invalidated, no audit row, nobody notices for months):**

```php
Order::where('status', 'pending')
    ->where('created_at', '<=', now()->subHours(2))
    ->update(['status' => 'expired']);
// OrderObserver::updated() — which flushes the cache tag — never ran.
```

**Correct — either fire the effect explicitly:**

```php
$count = $this->orders->expireAbandoned(CarbonImmutable::now()->subHours(2));

if ($count > 0) {
    Cache::tags(['orders'])->flush();
    OrdersExpired::dispatch($count);
}
```

**Or iterate when per-row effects genuinely matter:**

```php
Order::query()
    ->where('status', OrderStatus::Pending)
    ->where('created_at', '<=', $cutoff)
    ->chunkById(500, fn (Collection $orders) => $orders->each->update(['status' => OrderStatus::Expired]));
```

Choose by cost: thousands of rows with a required per-row side effect is a queued job over chunks, not a single bulk statement.

---

## Insert and Upsert in Batches, Not in a Loop

A loop that calls `create()` or `updateOrCreate()` issues one or two queries per row. For an import of 50,000 rows that is 50,000 round trips, each paying network latency.

`insert()` and `upsert()` write in batches. Batch in chunks of roughly 500 to 1,000 to stay under the driver's placeholder limit.

**Incorrect (100,000 queries for a 50,000-row import):**

```php
foreach ($rows as $row) {
    Product::updateOrCreate(
        ['sku' => $row['sku']],
        ['name' => $row['name'], 'price' => $row['price']],
    );
}
```

**Correct:**

```php
collect($rows)
    ->map(fn (array $row) => [
        'sku' => $row['sku'],
        'name' => $row['name'],
        'price' => $row['price'],
        'updated_at' => now(),
        'created_at' => now(),
    ])
    ->chunk(1000)
    ->each(fn (Collection $chunk) => Product::upsert(
        $chunk->all(),
        uniqueBy: ['sku'],
        update: ['name', 'price', 'updated_at'],
    ));
```

`upsert()` requires a unique or primary index on the `uniqueBy` columns. It does not fire model events — see `rules/bulk-update-bypasses-events.md`.

---
