# laravel-patterns

Placement rules for domain-driven Laravel applications — when to create an Action, Service, Repository, Query Class or Value Object, and when to just use Eloquent. Use when writing, reviewing or refactoring Laravel code that touches application structure, data access, domain boundaries or class placement. Triggers on questions like "where should this live", "should this be a service", "do I need a repository", or any new class in app/Domain.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. The Decision Gate

**Impact: CRITICAL**

Run before creating any class. Answer the gate questions in order and stop at the first match. Skipping the gate is how a codebase grows a Repository for every model or scatters queries across Actions.

---

## One Use Case Means One Action

Q1 of the Decision Gate. If the logic runs a single use case from entry to result — validate intent, coordinate collaborators, produce an outcome — it is an Action. Controllers, jobs and console commands are entry points, not homes for logic.

**Incorrect (use case spread across the controller):**

```php
final class SubmitPromptController
{
    public function __invoke(SubmitPromptRequest $request): JsonResponse
    {
        $conversation = Conversation::findOrFail($request->integer('conversation_id'));
        $provider = $conversation->tenant->plan === 'pro' ? new OpenAi() : new Ollama();
        $history = $conversation->messages()->latest()->take(20)->get();
        $answer = $provider->complete($history, $request->string('prompt'));
        $conversation->messages()->create(['role' => 'assistant', 'content' => $answer]);
        UsageRecord::create(['tenant_id' => $conversation->tenant_id, 'tokens' => $answer->tokens]);

        return response()->json(['answer' => $answer]);
    }
}
```

**Correct (controller maps HTTP, Action owns the use case):**

```php
final class SubmitPromptController
{
    public function __invoke(SubmitPromptRequest $request, SubmitPromptAction $action): JsonResponse
    {
        return response()->json(
            new MessageResource($action->handle($request->toDto())),
        );
    }
}

// app/Domain/Chat/Actions/SubmitPromptAction.php
final readonly class SubmitPromptAction
{
    public function __construct(
        private ChatRepositoryInterface $chat,
        private AiProviderRouterService $providers,
    ) {}

    public function handle(SubmitPromptData $data): Message
    {
        // one use case, end to end
    }
}
```

See `rules/action-naming-verb-noun.md` for naming.

---

## Use Eloquent Directly by Default

Q4 of the Decision Gate, and the default answer whenever Q4 and Q5 feel ambiguous. Eloquent is already a good abstraction. Simple CRUD, a single `where()->get()` used in one place, `Model::find()`, `$model->update()` — these need no Repository, no Query Class and no interface.

A Repository over Eloquent does not fully decouple you from Eloquent anyway: relationships, accessors and scopes remain. That is acceptable and expected. Do not chase purity.

**Incorrect (a layer that only forwards):**

```php
interface ConversationRepositoryInterface
{
    public function find(int $id): ?Conversation;
    public function create(array $attributes): Conversation;
}

final class EloquentConversationRepository implements ConversationRepositoryInterface
{
    public function find(int $id): ?Conversation
    {
        return Conversation::find($id);
    }

    public function create(array $attributes): Conversation
    {
        return Conversation::create($attributes);
    }
}
```

**Correct (call Eloquent, delete the layer):**

```php
final readonly class ArchiveConversationAction
{
    public function handle(Conversation $conversation): void
    {
        $conversation->update(['archived_at' => now()]);
    }
}
```

"Maybe someday we will switch databases" is not a valid trigger. See `rules/gate-repository-earns-its-name.md` for what is.

---

## Query Classes and Repositories Arrive Together

Query Classes and Repositories are not competing patterns. A Query Class is the *internal implementation technique* of a Repository: the Repository interface is the swappable public contract, and Query Classes are the named, focused, testable Eloquent queries it delegates to.

The trigger is the same for both — the query earns a name. So:

- Never create a Query Class without a Repository around it.
- Never create a Repository whose methods never delegate to one (if every method is a trivial inline, the Repository failed Q5).

**Incorrect (Query Class with no Repository — a second public data path):**

```php
final readonly class SubmitPromptAction
{
    public function __construct(private RecentMessagesQuery $recentMessages) {}

    public function handle(SubmitPromptData $data): Message
    {
        $history = $this->recentMessages->handle($data->conversation, 20);
        // ...
    }
}
```

**Correct (Action depends on the contract; the Repository owns the Query Class):**

```php
final readonly class SubmitPromptAction
{
    public function __construct(private ChatRepositoryInterface $chat) {}

    public function handle(SubmitPromptData $data): Message
    {
        $history = $this->chat->recentMessages($data->conversation, 20);
        // ...
    }
}

final readonly class EloquentChatRepository implements ChatRepositoryInterface
{
    public function __construct(private RecentMessagesQuery $recentMessages) {}

    public function recentMessages(Conversation $conversation, int $limit = 20): Collection
    {
        return $this->recentMessages->handle($conversation, $limit)->get();
    }
}
```

See `rules/query-internal-to-repositories.md` for the enforcement boundary.

---

## A Repository Must Name Its Trigger

Q5 of the Decision Gate. Create a Repository only when at least one trigger is true **and can be named concretely**:

1. **Backend swap** — the data source may change (relational DB to vector store, external API to local cache).
2. **Named query with reuse** — the query is important or complex and is called from enough places that one change point is required.

Write the trigger down. "For consistency with the other domains" is not a trigger.

**Incorrect (no named trigger):**

```php
// Why does this exist? Nobody can say.
interface TenantRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Tenant;
    public function paginate(int $perPage): LengthAwarePaginator;
}
```

**Correct (trigger stated in the docblock):**

```php
/**
 * Trigger: Q5(a) — message retrieval moves from MySQL LIKE search to a
 * pgvector similarity index in Q4. Callers must not change when it does.
 */
interface ChatRepositoryInterface
{
    public function recentMessages(Conversation $conversation, int $limit = 20): Collection;
    public function relevantMessages(Conversation $conversation, string $prompt, int $limit = 10): Collection;
}
```

```php
/**
 * Trigger: Q5(b) — order search drives the admin list, the CSV export and
 * the merchant dashboard. One change point for the filter rules.
 */
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}
```

---

## Run the Decision Gate Before Creating Any Class

Before creating a Service, Repository, Query Class or Value Object, answer the gate questions in order and write a one-line justification naming the concrete trigger. If you cannot name one, the layer must not exist.

The gate, in order — stop at the first match:

```
─── LOGIC PLACEMENT ───
Q1. Orchestrating a single end-to-end use case (HTTP/job entry → result)?
    YES → ACTION

Q2. Called from MORE THAN ONE Action, or complex enough to deserve
    isolated tests?
    YES → SERVICE

Q3. Used in ONLY ONE Action?
    YES → KEEP IT IN THAT ACTION. Do not extract.

─── DATA ACCESS ───
Q4. Simple CRUD or a one-off read/write that will stay on Eloquent
    forever?
    YES → USE ELOQUENT DIRECTLY. No Repository, no Query Class,
          no interface.

Q5. Either (a) likely to switch backends, or (b) named / important /
    reused / complex enough to deserve its own name and tests?
    YES → REPOSITORY (interface + implementation), delegating
          complex queries to Query Classes.
```

Both extremes are bugs: a Repository for every model is dead boilerplate, and no repositories at all means queries scattered across Actions, Services and Blade.

**Incorrect (layer created by reflex, no trigger named):**

```php
// "Every model gets a repository" — Q4 was never asked.
final class UsageRecordRepository
{
    public function find(int $id): ?UsageRecord
    {
        return UsageRecord::find($id);
    }
}
```

**Correct (justification names the trigger, or the layer is not created):**

```php
// Justification: Q5(a) — chat history moves from MySQL to a vector store
// in phase 2, so the backend must be swappable behind one contract.
interface ChatRepositoryInterface
{
    public function relevantMessages(Conversation $conversation, string $prompt, int $limit = 10): Collection;
}

// UsageRecord failed Q5 entirely → no repository. Eloquent directly:
UsageRecord::create(['tenant_id' => $tenant->id, 'tokens' => $tokens]);
```

See `rules/gate-eloquent-directly-by-default.md` for the default branch.

---

## Extract a Service Only When Two Actions Need It

Q2 and Q3 of the Decision Gate. A Service is warranted when the logic is invoked by two or more Actions, or when it is complex enough that isolating it materially improves testability. Logic used by exactly one Action stays in that Action.

"It might be reused later" is not a trigger. Extract when the second caller actually appears.

**Incorrect (one caller, extracted anyway):**

```php
// Called only by SubmitPromptAction. The indirection buys nothing.
final class PromptTrimmerService
{
    public function trim(string $prompt): string
    {
        return Str::limit(trim($prompt), 4000);
    }
}
```

**Correct (inline until a second Action needs it):**

```php
final readonly class SubmitPromptAction
{
    public function handle(SubmitPromptData $data): Message
    {
        $prompt = Str::limit(trim($data->prompt), 4000);
        // ...
    }
}
```

**Also correct (two callers → the Service is earned):**

```php
// Used by SubmitPromptAction and RegenerateAnswerAction, and its
// routing rules deserve isolated tests.
final readonly class AiProviderRouterService
{
    public function resolveFor(Tenant $tenant): AiProviderInterface { /* ... */ }
}
```

---

# 2. Actions

**Impact: HIGH**

An Action orchestrates exactly one use case end to end. It is the default home for logic — extraction to another layer must be earned.

---

## Keep Single-Use Logic Inside the Action

Q3 of the Decision Gate. If logic is used by exactly one Action, it belongs in that Action — as inline code or a `private` method. Do not create a Service, helper class or trait for it.

A `private` method inside the Action is the correct extraction when the `handle()` body gets long. It keeps the logic where its only caller is, and it costs nothing to inline later.

**Incorrect (one-caller Service, plus a trait nobody else uses):**

```php
final class OrderNumberGeneratorService
{
    public function generate(Merchant $merchant): string
    {
        return $merchant->prefix.'-'.Str::upper(Str::random(8));
    }
}

trait CalculatesOrderWeight { /* used by PlaceOrderAction only */ }
```

**Correct (private methods inside the single caller):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data, Merchant $merchant): Order
    {
        $order = $this->orders->place($data, $this->orderNumber($merchant));
        // ...
    }

    private function orderNumber(Merchant $merchant): string
    {
        return $merchant->prefix.'-'.Str::upper(Str::random(8));
    }
}
```

When a second Action needs `orderNumber()`, promote it to a Service then — not before.

---

## Map HTTP Input to Domain Types at the Edge

`Illuminate\Http\Request` stops at the Controller or Form Request. Everything inward — Actions, Services, Repositories, Query Classes — takes plain domain values, DTOs or Value Objects.

This is what makes an Action callable from a queue worker or a console command without inventing a fake request.

**Incorrect (Request travels inward):**

```php
final readonly class PlaceOrderAction
{
    public function handle(Request $request): Order { /* ... */ }
}

// Now the nightly import command has to fake a Request to reuse it.
```

**Correct (Form Request produces the DTO, Action takes the DTO):**

```php
final class StoreOrderRequest extends FormRequest
{
    public function toDto(): CreateOrderData
    {
        return new CreateOrderData(
            customerId: (int) $this->validated('customer_id'),
            items: $this->validated('items'),
        );
    }
}

final class StoreOrderController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($request->toDto())), 201);
    }
}

// The import command builds the same DTO from a CSV row — no HTTP involved.
$action->handle(new CreateOrderData(customerId: $row['customer'], items: $row['items']));
```

See `rules/vo-composite-filter-per-query.md` for the read-side equivalent.

---

## Name Actions Verb + Noun + Action

An Action is named `<Verb><Noun>Action` and lives in `app/Domain/<Context>/Actions/`. The directory listing should read as the domain's list of use cases.

Good: `PlaceOrderAction`, `SubmitPromptAction`, `CancelSubscriptionAction`, `RecordUsageAction`.
Bad: `OrderService`, `OrderManager`, `OrderHandler`, `ProcessOrder`, `OrderActions`.

**Incorrect (noun-only, plural, or a manager):**

```php
app/Domain/Orders/Actions/
    OrderActions.php        // several use cases in one file
    OrderManager.php        // says nothing about what it does
    ProcessOrder.php        // "process" is not a use case
```

**Correct (one verb-noun file per use case):**

```php
app/Domain/Orders/Actions/
    PlaceOrderAction.php
    CancelOrderAction.php
    RefundOrderAction.php
    ExpireAbandonedOrdersAction.php
```

An Action that needs a second public method is two Actions. Split it.

---

## An Action Orchestrates One Use Case End to End

An Action owns one use case from entry to result: it coordinates Services and Repositories, applies the workflow rules, dispatches side effects and returns a domain type. It is callable from a controller, a job, a console command or a test without change.

Shape: `final readonly`, constructor injection, one public `handle()`.

**Incorrect (Action returns an HTTP concern and reads the request):**

```php
final class PlaceOrderAction
{
    public function handle(Request $request): JsonResponse
    {
        $order = Order::create($request->validated());

        return response()->json(['id' => $order->id], 201);
    }
}
```

**Correct (domain in, domain out):**

```php
namespace App\Domain\Orders\Actions;

final readonly class PlaceOrderAction
{
    public function __construct(
        private OrderRepositoryInterface $orders,
        private PricingService $pricing,
    ) {}

    public function handle(CreateOrderData $data): Order
    {
        return DB::transaction(function () use ($data): Order {
            $order = $this->orders->place($data, $this->pricing->totalFor($data));

            OrderPlaced::dispatch($order->tenantId(), $order->id());

            return $order;
        });
    }
}
```

The controller maps `Request` to `CreateOrderData` and the result to a Resource. See `rules/action-maps-request-to-value-objects.md`.

---

# 3. Services

**Impact: HIGH**

A Service holds one business decision reused by two or more Actions. Premature Services are the most common over-abstraction in Laravel codebases.

---

## Name Services After the Business Decision

A Service is named `<Name>Service`, where the name states the *decision it makes*. A name that describes a decision has a natural boundary; a name that describes an entity attracts every method anyone can think of.

Good: `AiProviderRouterService`, `UsageCalculatorService`, `ConversationContextService`, `ProrationService`.
Bad: `OrderService`, `UserService`, `HelperService`, `CommonService`, `BusinessLogicService`.

**Incorrect (entity-named, so it grows without limit):**

```php
final class OrderService
{
    public function create(...) {}
    public function update(...) {}
    public function cancel(...) {}
    public function export(...) {}
    public function notify(...) {}
    public function calculateShipping(...) {}
}
```

**Correct (one decision per Service, plus Actions for the use cases):**

```php
final readonly class ShippingRateService     // decides a rate
final readonly class OrderEligibilityService // decides whether an order may be cancelled

// The verbs live in Actions:
PlaceOrderAction, CancelOrderAction, ExportOrdersAction
```

---

## A Service Never Imports a Query Class

For data access, a Service calls **Repository interfaces** for named or complex queries, and may use simple Eloquent or relationship calls for trivial reads. It must never import or instantiate a `*Query` class — those are internal to Repository implementations.

The same prohibition applies to Actions, Jobs, Commands, Controllers and Blade.

**Incorrect (Service reaches into the query layer):**

```php
use App\Domain\Orders\Queries\PendingOrdersQuery;

final readonly class MerchantAlertService
{
    public function __construct(private PendingOrdersQuery $pendingOrders) {}

    public function overdue(int $merchantId): Collection
    {
        return $this->pendingOrders->handle($merchantId)->get();
    }
}
```

**Correct (Service depends on the contract):**

```php
use App\Domain\Orders\Contracts\OrderRepositoryInterface;

final readonly class MerchantAlertService
{
    public function __construct(private OrderRepositoryInterface $orders) {}

    public function overdue(int $merchantId): Collection
    {
        return $this->orders->pendingOrders($merchantId);
    }
}
```

Grep for the violation: `grep -rl 'Queries\\' app --include='*.php' | grep -v '/Repositories/'` must return nothing.

---

## A Service Whose Body Is a Query Is a Mislabeled Repository

If a `*Service` contains nothing but raw Eloquent, it is not a Service. Either it is a Repository (interface plus Query-Class-backed implementation), or — if the backend will not change and it is used once — it is inline code in the Action.

A Service holds a business *decision*. A query is not a decision.

**Incorrect (a query wearing a Service name):**

```php
final class OrderSearchService
{
    public function search(?int $merchantId, ?string $status, ?string $from, ?string $to): Collection
    {
        return Order::query()
            ->when($merchantId, fn ($q) => $q->where('merchant_id', $merchantId))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->get();
    }
}
```

**Correct (Repository contract + Query Class, or nothing at all):**

```php
// app/Domain/Orders/Contracts/OrderRepositoryInterface.php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

// app/Domain/Orders/Queries/SearchOrdersQuery.php — owns the where() clauses
// app/Domain/Orders/Repositories/EloquentOrderRepository.php — executes them
```

If the search is used in exactly one place and will never move backends, delete the class and write the query in the Action.

---

## Services Are Stateless and Context-Agnostic

A healthy Service retains no state between calls, focuses on a single business decision domain, is callable from any Action regardless of what triggered it, takes its dependencies through the constructor, and returns domain types — never HTTP, job or queue concerns.

Under Octane or a long-lived queue worker, a stateful Service leaks one request's data into the next.

**Incorrect (accumulates state across calls, returns an HTTP type):**

```php
final class UsageCalculatorService
{
    private array $lines = [];

    public function add(UsageRecord $record): void
    {
        $this->lines[] = $record;         // survives into the next request
    }

    public function response(): JsonResponse
    {
        return response()->json($this->lines);
    }
}
```

**Correct (pure in, domain out):**

```php
final readonly class UsageCalculatorService
{
    public function __construct(private UsageRepositoryInterface $usage) {}

    public function costFor(TenantId $tenant, DateRange $period): Money
    {
        return $this->usage->totalTokens($tenant, $period)->costAtTier($this->tierFor($tenant));
    }

    private function tierFor(TenantId $tenant): Tier { /* ... */ }
}
```

---

## A Service Serves Two or More Actions

A Service is mandatory when the business logic is invoked by two or more Actions, or when it is complex enough that isolating it materially improves testability. Those are the only two triggers.

It is forbidden when the logic is used in exactly one Action.

**Incorrect (single caller wrapped for symmetry):**

```php
// app/Domain/Billing/Services/InvoiceNumberService.php
// Sole caller: IssueInvoiceAction.
final class InvoiceNumberService
{
    public function next(): string { /* ... */ }
}
```

**Correct (two Actions, one decision):**

```php
namespace App\Domain\Billing\Services;

/**
 * Called by RecordUsageAction and IssueInvoiceAction. The proration and
 * tier-boundary rules are worth testing without a use case around them.
 */
final readonly class UsageCalculatorService
{
    public function costFor(TenantId $tenant, DateRange $period): Money
    {
        // one business decision
    }
}
```

Counting callers is the test. If there is one, keep it in the Action — see `rules/action-keep-single-use-logic-inline.md`.

---

# 4. Repositories

**Impact: HIGH**

The Repository interface is the only public data-access boundary. It exists to make a backend swappable or to give an important query a single change point — never "for consistency".

---

## Bind the Interface in a Service Provider

The whole point of the interface is that switching backends is one line. Bind it in a service provider, type-hint the interface everywhere, and never call `app()` or `resolve()` inside domain classes.

**Incorrect (service location inside the domain):**

```php
final readonly class SubmitPromptAction
{
    public function handle(SubmitPromptData $data): Message
    {
        $chat = app(EloquentChatRepository::class);   // concrete, and hidden
        // ...
    }
}
```

**Correct (one binding, constructor injection everywhere):**

```php
// app/Providers/DomainServiceProvider.php
public function register(): void
{
    $this->app->bind(
        ChatRepositoryInterface::class,
        config('chat.vector_search') ? VectorStoreChatRepository::class : EloquentChatRepository::class,
    );

    $this->app->bind(OrderRepositoryInterface::class, EloquentOrderRepository::class);
}

// Everywhere else:
final readonly class SubmitPromptAction
{
    public function __construct(private ChatRepositoryInterface $chat) {}
}
```

Tests bind a fake with `$this->app->bind(ChatRepositoryInterface::class, fn () => $fake)`.

---

## Repository Methods Express Intent, Not CRUD

Interface methods name the business question, not the database operation. A CRUD-mirroring interface (`find`, `all`, `create`, `update`, `delete`) adds a layer without adding meaning — and it cannot survive a backend swap, because a vector store has no `all()`.

Good: `recentMessages()`, `relevantMessages()`, `searchOrders()`, `pendingOrders()`, `expireAbandoned()`.
Bad: `find()`, `all()`, `getByStatus()`, `firstWhere()`, `updateById()`.

**Incorrect (Eloquent's API with extra steps):**

```php
interface OrderRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Order;
    public function getByStatus(string $status): Collection;
    public function updateById(int $id, array $attributes): bool;
}
```

**Correct (questions the business actually asks):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
    public function pendingOrders(?int $merchantId = null): Collection;
    public function expireAbandoned(CarbonImmutable $expiredBefore): int;
}
```

Each method should map roughly one-to-one to a named query. See `rules/repo-inline-simple-delegate-complex.md`.

---

## Inline Simple Queries, Delegate Complex Ones

Inside a Repository implementation each method either inlines a simple query or delegates to a Query Class and executes the result into a domain type. Not every method needs a Query Class — a one-liner in the implementation is fine.

Delegate when the query has business meaning, coordinates several scopes, applies optional filters, controls eager loading, returns aggregates, has pagination or ordering rules, is reused by more than one method, or needs its own tests.

**Incorrect (a class per trivial line):**

```php
final readonly class ConversationLastMessageAtQuery
{
    public function handle(Conversation $conversation): ?CarbonImmutable
    {
        return $conversation->messages()->max('created_at');
    }
}
```

**Correct (mixed, by weight):**

```php
final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function __construct(
        private SearchOrdersQuery $searchOrders,
        private ExpireAbandonedOrdersQuery $expireAbandoned,
    ) {}

    // Delegated: many optional filters, eager loading, sorting rules, own tests.
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }

    // Inlined: one condition, no rules worth naming.
    public function pendingOrders(?int $merchantId = null): Collection
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->when($merchantId !== null, fn (Builder $q) => $q->where('merchant_id', $merchantId))
            ->get();
    }

    // Delegated: a conditional bulk write worth naming and testing.
    public function expireAbandoned(CarbonImmutable $expiredBefore): int
    {
        return $this->expireAbandoned->handle($expiredBefore);
    }
}
```

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

---

## A Repository Never Accepts a Request

Repository (and Query Class) inputs are plain domain values, DTOs or Value Objects. `Illuminate\Http\Request` never crosses the boundary — HTTP mapping stays in the Controller or Form Request.

A Repository that takes a `Request` cannot be called from a console command, a queued job or a test without fabricating one.

**Incorrect:**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(Request $request): LengthAwarePaginator;
}
```

**Correct:**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

// Controller builds the filter:
$filter = new OrderQueryFilter(
    merchantId: $request->integer('merchant_id') ?: null,
    status: $request->enum('status', OrderStatus::class),
    dateRange: $dateRange,
);

// Nightly export command builds the same filter from arguments:
$filter = new OrderQueryFilter(dateRange: (new Yesterday())->range());
```

See `rules/vo-composite-filter-per-query.md` for building the filter.

---

## A Repository Interface Never Returns a Builder

Interface methods return domain types: `Collection`, `LengthAwarePaginator`, `Model`, `int`, `bool`, or a domain DTO. Returning `Illuminate\Database\Eloquent\Builder` publishes Eloquent as the contract, so every caller becomes coupled to it and the interface can never be implemented by anything else.

Returning a `Builder` is allowed in exactly one place: from a Query Class's `handle()`, which is internal to the Repository.

**Incorrect (Eloquent leaks through the contract):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter): Builder;
}

// Callers now do this, and the "swappable backend" is fiction:
$orders->searchOrders($filter)->whereNotNull('shipped_at')->paginate(25);
```

**Correct (the Repository executes; the Builder stays inside):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function __construct(private SearchOrdersQuery $searchOrders) {}

    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }
}
```

If a caller needs `shipped_at` filtering, add it to `OrderQueryFilter` — that is the contract widening on purpose.

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

---

## Keep Repository Interfaces Small

Aim for fewer than about six methods per interface. A `*RepositoryInterface` with fifteen methods, most used in one or two places, is several interfaces stuck together: it is painful to fake in tests and impossible to reimplement for a new backend.

Split by the question being asked, not by the model.

**Incorrect (one interface for everything Order-shaped):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(...);
    public function pendingOrders(...);
    public function expireAbandoned(...);
    public function revenueByMonth(...);
    public function topMerchants(...);
    public function exportRows(...);
    public function abandonedCartCount(...);
    public function refundTotals(...);
    // ...
}
```

**Correct (split by concern):**

```php
interface OrderRepositoryInterface        // operational reads and writes
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
    public function pendingOrders(?int $merchantId = null): Collection;
    public function expireAbandoned(CarbonImmutable $expiredBefore): int;
}

interface OrderReportingRepositoryInterface   // dashboard aggregates
{
    public function revenueByMonth(DateRange $period): Collection;
    public function topMerchants(DateRange $period, int $limit = 10): Collection;
}
```

A fake for a three-method interface is five lines. A fake for a fifteen-method one never gets written.

---

# 5. Query Classes

**Impact: HIGH**

A Query Class is one named Eloquent query behind a single `handle()`. It is the only place query construction lives, and it is internal to Repository implementations.

---

## A Query Class May Write

A write whose main value is the database operation itself — a bulk `update` or `delete` with important conditions — belongs in a Query Class. Same shape as a read: one `handle()`, a business-question name, exposed through the Repository.

If the write is part of a larger business workflow with side effects (dispatching jobs, sending mail, deciding rules), it belongs in an Action that calls the Repository instead.

**Incorrect (conditional bulk write inline in a scheduled command):**

```php
Schedule::call(function (): void {
    Order::where('status', 'pending')
        ->where('created_at', '<=', now()->subHours(2))
        ->update(['status' => 'expired', 'expired_at' => now()]);
})->hourly();
```

**Correct (named, tested, behind the repository):**

```php
final readonly class ExpireAbandonedOrdersQuery
{
    public function handle(CarbonImmutable $expiredBefore): int
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->where('created_at', '<=', $expiredBefore)
            ->update(['status' => OrderStatus::Expired, 'expired_at' => now()]);
    }
}

// Repository exposes it; the scheduled command calls the repository.
$expired = $orders->expireAbandoned(CarbonImmutable::now()->subHours(2));
```

Note that a bulk `update()` bypasses model events and observers — if listeners must fire, use an Action that iterates, or dispatch the event yourself.

---

## Compose Query Classes Instead of Duplicating Clauses

A Query Class may inject another Query Class through its constructor. Composition stays inside the repository layer, so the query-construction boundary is preserved.

When the same clause repeats — a date-range `where`, a tenant scope — extract a `private` helper inside each Query Class that needs it, or compose. Never move it onto a Value Object (see `rules/vo-never-touches-builder.md`).

**Incorrect (shared clause pushed onto the Value Object to avoid repeating it):**

```php
final readonly class DateRange
{
    public function apply(Builder $query, string $column): Builder   // boundary violation
    {
        return $query->whereBetween($column, [$this->from, $this->to]);
    }
}
```

**Correct (compose, or keep a private helper per query):**

```php
final readonly class MerchantRevenueQuery
{
    public function __construct(private SearchOrdersQuery $searchOrders) {}

    public function handle(OrderQueryFilter $filter): Builder
    {
        return $this->searchOrders->handle($filter)
            ->selectRaw('merchant_id, sum(total) as revenue')
            ->groupBy('merchant_id');
    }
}
```

```php
// Or, in each query that needs it:
private function applyDateRange(Builder $q, DateRange $range, string $column): void
{
    $q->where(function (Builder $q) use ($range, $column): void {
        if ($range->from !== null) { $q->where($column, '>=', $range->from); }
        if ($range->to !== null) { $q->where($column, '<=', $range->to); }
    });
}
```

---

## Plain final readonly, No Abstract Query Base

Start every Query Class as a plain `final readonly class`. Do not create an abstract `Query` base, a `HasFilters` trait or a generic `AbstractQuery` with template methods. Share only after real, repeated duplication — and prefer composition (`rules/query-compose-query-classes.md`) over inheritance when you do.

**Incorrect (framework grown before the second use case):**

```php
abstract class Query
{
    abstract protected function baseQuery(): Builder;
    abstract protected function filters(): array;

    public function handle(mixed $filter): Builder
    {
        $query = $this->baseQuery();
        foreach ($this->filters() as $apply) { $apply($query, $filter); }
        return $query;
    }
}

final class SearchOrdersQuery extends Query { /* now indirect and untraceable */ }
```

**Correct:**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->with(['customer', 'merchant'])/* ... */;
    }
}
```

You can read the whole query in one file. That is the point.

---

## Query Classes Are Internal to Repositories

Only files under `*/Repositories/` may import or instantiate a `*Query` class. Controllers, Actions, Services, Jobs, Commands, Blade views and application-logic tests call the Repository interface instead.

If a Query Class is reachable from outside, there are now two public data-access paths and the Repository contract stops meaning anything.

**Incorrect (Controller and Job both reach into the query layer):**

```php
use App\Domain\Orders\Queries\PendingOrdersQuery;

final class OrderDashboardController
{
    public function __invoke(PendingOrdersQuery $pendingOrders): View
    {
        return view('dashboard', ['orders' => $pendingOrders->handle(null)->get()]);
    }
}
```

**Correct (everything goes through the interface):**

```php
use App\Domain\Orders\Contracts\OrderRepositoryInterface;

final class OrderDashboardController
{
    public function __invoke(OrderRepositoryInterface $orders): View
    {
        return view('dashboard', ['orders' => $orders->pendingOrders()]);
    }
}
```

Enforce it in CI:

```bash
grep -rln 'use App\\Domain\\[A-Za-z]*\\Queries\\' app --include='*.php' \
  | grep -v '/Repositories/' && exit 1 || exit 0
```

---

## Name a Query Class After the Business Question

Name the question the business asks, not the database operation performed. If the best name you can find just repeats an Eloquent method, the query did not need its own class.

Good: `PendingOrdersQuery`, `SearchOrdersQuery`, `ExpireAbandonedOrdersQuery`, `RecentMessagesQuery`, `RelevantMessagesBySimilarityQuery`.
Bad: `GetOrdersQuery`, `FetchProductsQuery`, `FindArticleByIdQuery`, `OrderQuery`.

**Incorrect:**

```php
final readonly class FindArticleByIdQuery
{
    public function handle(int $id): ?Article
    {
        return Article::find($id);   // the name is the giveaway
    }
}
```

**Correct (name states the rule the query encodes):**

```php
final readonly class ExpireAbandonedOrdersQuery
{
    public function handle(CarbonImmutable $expiredBefore): int { /* ... */ }
}

final readonly class RelevantMessagesBySimilarityQuery
{
    public function handle(Conversation $conversation, string $prompt, int $limit): Builder { /* ... */ }
}
```

---

## All Query Construction Lives in Query Classes and Repositories

`Builder`, `where()`, `orderBy()`, `join()`, `DB::raw()`, CTEs, query-expression objects — all of it appears only inside Query Classes and Repository implementations. Never in Controllers, Actions, Services, Jobs, Commands, Blade or Value Objects.

Inside those two places, embrace Eloquent openly. Coupling to relationships, accessors and scopes there is fine and expected.

**Incorrect (the same intent rebuilt in three files):**

```php
// Controller
$orders = Order::where('status', 'pending')->where('merchant_id', $id)->get();

// Service
$count = Order::where('status', 'pending')->count();

// Blade
@foreach (\App\Models\Order::where('status', 'pending')->get() as $order)
```

**Correct (one named query, three callers of one contract):**

```php
// app/Domain/Orders/Queries/PendingOrdersQuery.php
final readonly class PendingOrdersQuery
{
    public function handle(?int $merchantId = null): Builder
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->when($merchantId !== null, fn (Builder $q) => $q->where('merchant_id', $merchantId));
    }
}

// Callers:
$orders->pendingOrders($merchantId);
$orders->countPending();
// Blade receives the result from the controller — it never queries.
```

See `rules/vo-never-touches-builder.md` for the other half of this boundary.

---

## Return a Builder or Execute, One per Query

Choose one return style per Query Class:

- **Execute inside `handle()`** when there is one expected result type — return `Collection`, `LengthAwarePaginator`, `int`, `Model` or `bool`.
- **Return a `Builder`** when callers legitimately need different result types (paginate here, `get()` there, `count()` in a badge) and let the Repository method execute it.

Returning a `Builder` is allowed here and nowhere else. The Repository interface still returns a domain type.

**Incorrect (executed too early, so the export has to re-implement the filters):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Collection
    {
        return Order::query()/* filters */->get();   // export needs a cursor, dashboard needs a count
    }
}
```

**Correct (Builder out, Repository decides how to run it):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder { /* ... */ }
}

final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }

    public function countMatching(OrderQueryFilter $filter): int
    {
        return $this->searchOrders->handle($filter)->count();
    }

    public function streamMatching(OrderQueryFilter $filter): LazyCollection
    {
        return $this->searchOrders->handle($filter)->lazyById();
    }
}
```

---

## A Query Class Has Exactly One Public Method

A Query Class is a small `final readonly` object representing one named database query or operation. Its only public method is `handle()`. Helpers are `private`.

More than one public method means more than one query class hiding in one file. Split it.

**Incorrect (three queries in one class):**

```php
final readonly class OrderQueries
{
    public function pending(int $merchantId): Collection { /* ... */ }
    public function search(OrderQueryFilter $filter): Builder { /* ... */ }
    public function expire(CarbonImmutable $before): int { /* ... */ }
}
```

**Correct (one file per question, private helpers):**

```php
final readonly class SearchOrdersQuery
{
    private const SORTABLE = ['created_at', 'number', 'total'];

    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()
            ->with(['customer', 'merchant'])
            ->when($filter->dateRange !== null, fn (Builder $q) => $this->applyDateRange($q, $filter->dateRange, 'created_at'));
    }

    private function applyDateRange(Builder $q, DateRange $range, string $column): void { /* ... */ }
}
```

---

## Whitelist Sortable Columns in the Query Class

`orderBy()` takes a raw column name. A user-supplied sort column lets an attacker probe your schema through error messages and order results by columns you never meant to expose. Validate against an allow-list at the Query Class level — the layer that actually writes the `orderBy`.

Doing this in the Form Request as well is fine; doing it *only* there is not, because the Query Class is also reached from commands and jobs.

**Incorrect (raw input into orderBy):**

```php
public function handle(OrderQueryFilter $filter): Builder
{
    return Order::query()->orderBy($filter->sorting->column, $filter->sorting->direction->value);
}
```

**Correct (allow-list plus a deterministic fallback):**

```php
final readonly class SearchOrdersQuery
{
    private const SORTABLE = ['created_at', 'number', 'total'];

    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->when(
            $filter->sorting !== null && in_array($filter->sorting->column, self::SORTABLE, true),
            fn (Builder $q) => $q->orderBy($filter->sorting->column, $filter->sorting->direction->value),
            fn (Builder $q) => $q->latest(),
        );
    }
}
```

The same rule applies to any user-controlled identifier reaching `orderBy`, `groupBy`, `having` or a raw expression.

---

# 6. Value Objects and Parameter Isolation

**Impact: MEDIUM-HIGH**

Group related or recurring parameters into immutable Value Objects. Value Objects are pure data plus pure predicates — they never touch a Builder.

---

## Collapse a Query's Inputs into One Composite Filter

When a query's inputs grow, bundle them into a domain-specific filter DTO so `handle()` takes a single argument. The DTO lives in `app/Domain/<Context>/Filters/`, composed from shared Value Objects.

The Controller maps `Request` to the DTO. HTTP stays at the edge.

**Incorrect (parameters added one at a time, every caller edited each time):**

```php
public function handle(?int $merchantId, ?OrderStatus $status, ?CarbonImmutable $from, ?CarbonImmutable $to, ?string $search): Builder
```

**Correct:**

```php
namespace App\Domain\Orders\Filters;

final readonly class OrderQueryFilter
{
    public function __construct(
        public ?int $merchantId = null,
        public ?OrderStatus $status = null,
        public ?DateRange $dateRange = null,
        public ?string $search = null,
        public ?Sorting $sorting = null,
    ) {}
}
```

```php
final class OrderIndexController
{
    public function __invoke(Request $request, OrderRepositoryInterface $orders): View
    {
        $dateRange = ($request->filled('from') || $request->filled('to'))
            ? new DateRange($request->date('from')?->toImmutable(), $request->date('to')?->toImmutable())
            : null;

        $filter = new OrderQueryFilter(
            merchantId: $request->integer('merchant_id') ?: null,
            status: $request->enum('status', OrderStatus::class),
            dateRange: $dateRange,
            search: $request->string('search')->trim()->toString() ?: null,
            sorting: $request->filled('sort')
                ? new Sorting($request->string('sort')->toString(), Direction::from($request->string('dir', 'desc')->toString()))
                : null,
        );

        return view('admin.orders.index', ['orders' => $orders->searchOrders($filter, perPage: 25)]);
    }
}
```

Named arguments keep the call readable as the DTO grows.

---

## Express Named Date Ranges Through an Interface

A `DateRangable` interface lets you express periods as named business concepts and select them polymorphically. `range()` resolves a preset into a concrete `DateRange`.

Generic, cross-domain interfaces live in `app/Contracts/`. The presets live with their Value Object under `app/Support/Filters/Date/Presets/`.

**Incorrect (period logic re-derived at every call site):**

```php
$from = now()->startOfMonth();
$to = now()->endOfMonth();
$revenue = $reports->revenueBetween($from, $to);

// elsewhere, subtly different:
$from = now()->startOfMonth();
$to = now();
```

**Correct (named, resolved once):**

```php
namespace App\Contracts;

interface DateRangable
{
    public function range(): DateRange;
}
```

```php
namespace App\Support\Filters\Date\Presets;

final readonly class ThisMonth implements DateRangable
{
    public function range(): DateRange
    {
        $now = CarbonImmutable::now();

        return new DateRange($now->startOfMonth(), $now->endOfMonth());
    }
}
```

```php
$revenue = $reports->revenue((new ThisMonth())->range());

// Selecting a preset from user input:
$preset = match ($request->string('period')->toString()) {
    'today' => new Today(),
    'month' => new ThisMonth(),
    default => new LastNMonths(3),
};
$revenue = $reports->revenue($preset->range());
```

Use one suffix convention consistently: `DateRangable`, or `ResolvesDateRange`, or `ProvidesDateRange`. Pick one.

---

## Group Contextually Related Parameters

This is the Parameter Object technique, and it applies to *any* method in any layer — Action, Service, Repository, Query Class, controller, job, command. It is not specific to `handle()`.

Encapsulate into a Value Object when any of these is true:

- The parameters belong together conceptually (`from` + `to` → `DateRange`; `column` + `direction` → `Sorting`). Two parameters is enough if they are a coherent unit.
- The method has more than four parameters (see `rules/vo-more-than-four-params.md`).
- The same parameter group recurs across two or more call sites.
- The group needs pure behavior — validation, defaults, predicates like `covers()`.

**Incorrect (a pair that always travels together, passed apart):**

```php
public function revenueBetween(?CarbonImmutable $from, ?CarbonImmutable $to): Money
public function ordersBetween(?CarbonImmutable $from, ?CarbonImmutable $to): Collection
public function exportBetween(?CarbonImmutable $from, ?CarbonImmutable $to): string
// Three signatures to change when the period gains a timezone.
```

**Correct:**

```php
public function revenue(DateRange $period): Money
public function orders(DateRange $period): Collection
public function export(DateRange $period): string
```

See `rules/vo-no-single-scalar-wrapper.md` for when *not* to do this.

---

## More Than Four Parameters Must Be Grouped

A signature with more than four parameters must be reduced by grouping, regardless of layer. This is a hard trigger, not a preference: past four, call sites become positional puzzles and every new filter is a breaking change to every caller.

**Incorrect (seven parameters, three of them nullable booleans):**

```php
public function searchOrders(
    ?int $merchantId,
    ?string $status,
    ?CarbonImmutable $from,
    ?CarbonImmutable $to,
    ?string $search,
    ?string $sortColumn,
    ?string $sortDirection,
): LengthAwarePaginator
```

**Correct (one composite filter):**

```php
public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
```

```php
final readonly class OrderQueryFilter
{
    public function __construct(
        public ?int $merchantId = null,
        public ?OrderStatus $status = null,
        public ?DateRange $dateRange = null,
        public ?string $search = null,
        public ?Sorting $sorting = null,
    ) {}
}
```

Adding a filter now touches the DTO and the Query Class — not every caller.

---

## A Value Object Never Touches a Builder

A Value Object holds data and exposes pure methods only: predicates (`covers()`, `isBounded()`), transformations (`intersect()`, `expand()`), named constructors (`latest()`, `oldest()`).

It must never import `Illuminate\Database\Eloquent\Builder`, accept a `Builder` in any method, or call `where()` / `orderBy()` / any query-builder method. An `apply(Builder $query)` method on a Value Object smuggles query logic out of the query layer and re-scatters it.

The Query Class reads the Value Object's data and writes the clause itself.

**Incorrect (the boundary violation):**

```php
use Illuminate\Database\Eloquent\Builder;

final readonly class DateRange
{
    public function apply(Builder $query, string $column): Builder
    {
        return $query->whereBetween($column, [$this->from, $this->to]);
    }
}
```

**Correct (pure data and pure predicates):**

```php
final readonly class DateRange
{
    public function __construct(
        public ?CarbonImmutable $from = null,
        public ?CarbonImmutable $to = null,
    ) {}

    public function isBounded(): bool
    {
        return $this->from !== null || $this->to !== null;
    }

    public function covers(CarbonImmutable $date): bool
    {
        return ($this->from === null || $date->greaterThanOrEqualTo($this->from))
            && ($this->to === null || $date->lessThanOrEqualTo($this->to));
    }
}
```

```php
// The Query Class writes the clause:
private function applyDateRange(Builder $q, DateRange $range, string $column): void
{
    $q->where(function (Builder $q) use ($range, $column): void {
        if ($range->from !== null) { $q->where($column, '>=', $range->from); }
        if ($range->to !== null) { $q->where($column, '<=', $range->to); }
    });
}
```

If that helper repeats across Query Classes, keep the repetition inside the query layer — see `rules/query-compose-query-classes.md`.

---

## Never Wrap a Single Unrelated Scalar

Value Objects exist to keep signatures clean and to give related data a home. They are a tool, not a mandate. Do not encapsulate when:

- It is a single unrelated scalar — `MerchantIdFilter` is wrong; keep `?int $merchantId`.
- The method has four or fewer trivial, unrelated parameters with no contextual cluster.
- There is no behavior to add and no reuse — a one-field data bag is noise.

Identity value objects (`TenantId`, `OrderId`) are a deliberate exception: they exist to carry type safety across domain boundaries, not to tidy a signature.

**Incorrect:**

```php
final readonly class MerchantIdFilter { public function __construct(public int $value) {} }
final readonly class PerPage { public function __construct(public int $value) {} }
final readonly class SearchTerm { public function __construct(public string $value) {} }

public function pendingOrders(MerchantIdFilter $merchant, PerPage $perPage): Collection
```

**Correct:**

```php
public function pendingOrders(?int $merchantId = null, int $perPage = 25): Collection
```

Two scalars with no relationship stay scalars.

---

## Parameterize Presets Instead of Copying Classes

A family of presets that differ only by a number is one parameterized class. `LastThreeMonths`, `LastSixMonths` and `LastTwelveMonths` are `LastNMonths`.

Add a thin named alias only when the name itself is a domain term people say out loud.

**Incorrect (a class per number):**

```php
final readonly class LastThreeMonths implements DateRangable { /* ... */ }
final readonly class LastSixMonths implements DateRangable { /* ... */ }
final readonly class LastTwelveMonths implements DateRangable { /* ... */ }
final readonly class PreviousSevenDays implements DateRangable { /* ... */ }
final readonly class PreviousThirtyDays implements DateRangable { /* ... */ }
```

**Correct (one shape covers the family, validated):**

```php
final readonly class LastNMonths implements DateRangable
{
    public function __construct(private int $n)
    {
        if ($n < 1) {
            throw new InvalidArgumentException('LastNMonths requires n >= 1.');
        }
    }

    public function range(): DateRange
    {
        $now = CarbonImmutable::now();

        return new DateRange($now->subMonths($this->n)->startOfMonth(), $now->endOfMonth());
    }
}

// Alias only where the name carries business meaning:
final readonly class TrailingQuarter implements DateRangable
{
    public function range(): DateRange
    {
        return (new LastNMonths(3))->range();
    }
}
```

Fixed-boundary presets that are not a numeric family still get their own class: `Today`, `ThisWeek`, `ThisMonth`, `LastMonth`, `ThisQuarter`, `ThisYear`, `LastYear`.

---

## Pass Essential Domain Objects Directly

An essential domain object — the thing the operation is *about* — is passed as its own parameter, not buried inside a filter DTO. Burying it hides the subject of the call and makes the DTO mean two different things.

**Incorrect (the conversation, which is mandatory, hidden among optional filters):**

```php
final readonly class MessageQueryFilter
{
    public function __construct(
        public Conversation $conversation,   // not a filter — it is the subject
        public ?int $limit = null,
        public ?DateRange $dateRange = null,
    ) {}
}

$chat->recentMessages(new MessageQueryFilter($conversation, limit: 20));
```

**Correct (subject first, filters grouped):**

```php
public function recentMessages(Conversation $conversation, int $limit = 20): Collection;

public function searchMessages(Conversation $conversation, MessageQueryFilter $filter): Collection;
```

The signature now says what the query is about and what narrows it.

---

# 7. Directory and Namespace Layout

**Impact: MEDIUM**

Layout is domain-first. Scope decides placement: shareable code goes top-level, single-domain code stays inside its domain.

---

## Contracts Hold Interfaces, Support Holds Implementations

`app/Contracts/` holds generic interfaces only — the Laravel-style contracts of your application (`DateRangable`, `Castable` helpers, cross-cutting abstractions). `app/Support/` holds the concrete generic Value Objects, presets and query-expression helpers that implement or accompany them.

Domain equivalents mirror this: `Domain/<Context>/Contracts/` for interfaces and cross-domain DTOs, `Domain/<Context>/Support/` for that domain's helpers.

**Incorrect (mixed responsibilities in one folder):**

```
app/Support/
  DateRangable.php          // an interface
  DateRange.php
  OrderRepositoryInterface.php   // domain-specific, and an interface
```

**Correct:**

```
app/Contracts/
  DateRangable.php

app/Support/
  Filters/Date/DateRange.php
  Filters/Date/Presets/ThisMonth.php
  Filters/Sorting.php
  Filters/Direction.php
  Query/DateFmt.php              // driver-aware SQL expression helper

app/Domain/Orders/Contracts/
  OrderRepositoryInterface.php
  OrderIntegrationInterface.php  // public cross-domain surface
```

`app/Support/Query/` helpers are query construction, so they are still used only inside Query Classes and Repositories.

---

## Organize by Domain, Not by Layer

Layout is domain-first. Each bounded context owns its Actions, Services, Contracts, Repositories, Queries, Filters, Models, Events and Listeners. Never create top-level `app/Services/`, `app/Repositories/` or `app/Queries/`.

Top-level `app/Support/` (generic Value Objects) and `app/Contracts/` (generic interfaces) are the two permitted exceptions.

**Incorrect (layer-first: one feature scattered across eight folders):**

```
app/
  Services/OrderService.php
  Repositories/OrderRepository.php
  Queries/SearchOrdersQuery.php
  Filters/OrderQueryFilter.php
  Models/Order.php
  Events/OrderPlaced.php
```

**Correct (domain-first):**

```
app/
  Contracts/
    DateRangable.php
  Support/
    Filters/
      Date/DateRange.php
      Date/Presets/{Today,ThisMonth,LastNMonths}.php
      Sorting.php
      Direction.php
  Domain/
    Orders/
      Contracts/OrderRepositoryInterface.php
      Actions/{PlaceOrderAction,CancelOrderAction}.php
      Services/ShippingRateService.php
      Repositories/EloquentOrderRepository.php
      Queries/{SearchOrdersQuery,PendingOrdersQuery,ExpireAbandonedOrdersQuery}.php
      Filters/OrderQueryFilter.php
      Events/OrderPlaced.php
      Resources/OrderResource.php
      Exceptions/OrderException.php
      Models/Order.php
    Billing/
      Actions/RecordUsageAction.php
      Services/UsageCalculatorService.php
      Listeners/RecordOrderUsage.php
```

Full tree and folder meanings: `references/directory-layout.md`.

---

## No Top-Level Services, Repositories or Queries Folders

`app/Services/`, `app/Repositories/` and `app/Queries/` must not exist. They are layer-first buckets: everything lands in them, nothing is bounded, and cross-domain imports become invisible.

Permitted top-level folders beyond Laravel's own: `app/Contracts/` (generic interfaces), `app/Support/` (generic Value Objects and query-expression helpers), `app/Domain/` (bounded contexts), `app/Infrastructure/` (adapters for external systems).

**Incorrect:**

```
app/Services/         42 files, 6 domains, no boundaries
app/Repositories/     one per model
app/Queries/          imported from anywhere
```

**Correct:**

```
app/Contracts/
app/Support/
app/Infrastructure/AiProvider/
app/Domain/<Context>/{Contracts,Actions,Services,Repositories,Queries,Filters,Events,Listeners,Resources,Exceptions,Concern,Support,Models}/
```

Add a CI guard:

```bash
test ! -d app/Services && test ! -d app/Repositories && test ! -d app/Queries
```

---

## A Missing Folder Is a Decision, Not an Oversight

Each domain has only the folders it needs. A domain with no `Contracts/`, `Repositories/`, `Queries/` or `Filters/` is a deliberate call — that domain is simple CRUD and uses Eloquent directly.

Do not scaffold empty folders "so all domains look the same". Symmetry is not a design goal; it is how boilerplate spreads.

**Incorrect (empty layers created for uniformity):**

```
app/Domain/Billing/
  Contracts/          (empty)
  Repositories/       (empty)
  Queries/            (empty)
  Filters/            (empty)
  Actions/RecordUsageAction.php
```

**Correct (record the decision in the domain README or a docblock):**

```
app/Domain/Billing/
  Actions/RecordUsageAction.php
  Services/UsageCalculatorService.php
  Listeners/RecordOrderUsage.php
  Models/UsageRecord.php
  # No Contracts/Repositories/Queries: usage records are simple CRUD on
  # Eloquent and no query here has earned a name. Revisit if metering
  # moves to a time-series store.
```

When a folder is finally needed, the trigger will be nameable — see `rules/gate-repository-earns-its-name.md`.

---

## Scope Decides Placement

The principle: generic and shareable across domains goes top-level; anything used by a single domain stays inside that domain.

- Generic Value Objects → `app/Support/Filters/<Concept>/` (Value Object, presets and companions together).
- Generic interfaces → `app/Contracts/`.
- Domain interfaces (Repository contracts, integration contracts) → `app/Domain/<Context>/Contracts/`.
- Domain traits → `app/Domain/<Context>/Concern/`.
- Domain helpers and Value Objects → `app/Domain/<Context>/Support/`.
- Domain composite filters → `app/Domain/<Context>/Filters/`.

`app/Support/` and `app/Contracts/` are only for things reused by two or more domains.

**Incorrect (single-domain code promoted to shared):**

```
app/Support/OrderQueryFilter.php        // only Orders uses it
app/Contracts/OrderRepositoryInterface.php
app/Support/CalculatesProration.php     // only Billing uses it
```

**Correct:**

```
app/Domain/Orders/Filters/OrderQueryFilter.php
app/Domain/Orders/Contracts/OrderRepositoryInterface.php
app/Domain/Billing/Concern/CalculatesProration.php

app/Support/Filters/Date/DateRange.php   // Orders, Billing and Reporting all use it
app/Contracts/DateRangable.php
```

A Value Object with no preset family may sit at the `Filters/` root (`Sorting.php`, `Direction.php`).

---

# 8. Inter-Domain Communication

**Impact: HIGH**

Domains are bounded contexts. A domain's Models, Repositories and Queries are private; only its Contracts and Events are public. Cross-domain integration uses Domain Events, an Open Host Service, the Shared Kernel, or an Anti-Corruption Layer.

---

## Wrap External Upstreams in an Anti-Corruption Layer

When a domain consumes something it does not control — a third-party API, a legacy system, another team's unstable service — wrap it in a Translator or Adapter that converts the upstream model into your domain's own model.

Place it in the consumer's `Domain/<Context>/ACL/`, or in `app/Infrastructure/` when several domains share the adapter.

**Incorrect (the vendor's payload shape spreads through the domain):**

```php
final readonly class SubmitPromptAction
{
    public function handle(SubmitPromptData $data): Message
    {
        $response = Http::post('https://api.provider.test/v1/chat', [...])->json();

        return Message::create([
            'content' => $response['choices'][0]['message']['content'],   // vendor shape
            'tokens' => $response['usage']['total_tokens'],
        ]);
    }
}
```

**Correct (one translator owns the vendor's shape):**

```php
// app/Infrastructure/AiProvider/AiProviderInterface.php
interface AiProviderInterface
{
    public function complete(PromptContext $context): Completion;   // domain types
}

// app/Infrastructure/AiProvider/OpenAiProvider.php
final readonly class OpenAiProvider implements AiProviderInterface
{
    public function complete(PromptContext $context): Completion
    {
        $response = $this->http->post('/v1/chat/completions', $this->toPayload($context))->json();

        return new Completion(
            content: $response['choices'][0]['message']['content'],
            tokens: $response['usage']['total_tokens'],
        );
    }
}
```

The domain now depends on `Completion`. Swapping providers, or absorbing a breaking upstream change, edits one class.

---

## Use Domain Events for Cross-Domain Reactions

When domain A's state changes meaningfully and domain B must react, A dispatches a Domain Event and B listens in its own model. This is the preferred pattern for "when X happens in A, B does Y".

Rules:

- Events live with the **producer**: `Domain/<Context>/Events/`. Immutable, past-tense: `OrderPlaced`, `ConversationCompleted`, `UsageThresholdReached`.
- Events carry **identity plus minimal data** — `OrderId`, Value Objects. Never aggregate roots or Eloquent Models.
- Listeners live with the **consumer**: `Domain/<OtherContext>/Listeners/`. A listener touches only its own domain's Repositories and Actions.
- Side-effecting listeners run **queued**. Pure read-model projections may run inline.

**Incorrect (producer performs the consumer's work, and ships a Model):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = $this->orders->place($data);

        UsageRecord::create(['amount' => $order->total]);          // Billing's job
        Mail::to($order->customer)->send(new OrderConfirmation($order));

        return $order;
    }
}
```

**Correct (producer announces, consumers react on their own side):**

```php
// Domain/Orders/Events/OrderPlaced.php
final readonly class OrderPlaced
{
    public function __construct(public TenantId $tenantId, public OrderId $orderId) {}
}

// Domain/Orders/Actions/PlaceOrderAction.php
DB::transaction(fn () => $order = $this->orders->place($data));
OrderPlaced::dispatch($order->tenantId(), $order->id());

// Domain/Billing/Listeners/RecordOrderUsage.php   — queued, Billing's data only
// Domain/Notifications/Listeners/SendOrderConfirmation.php — queued
```

Dispatch after the transaction commits so listeners never read uncommitted state.

---

## Never Import Another Domain's Models, Repositories or Queries

`use App\Domain\<Other>\Models\…`, `…\Repositories\…` and `…\Queries\…` are forbidden across domain boundaries. Cross-boundary data is identities, DTOs and Value Objects only — never another domain's Eloquent Model.

A Model that crosses a boundary drags its relationships, casts, scopes and observers with it. Two contexts that share a Model are one context with extra folders.

**Incorrect (a Model crosses, and with it the whole object graph):**

```php
// Domain/Billing/Listeners/RecordOrderUsage.php
use App\Domain\Orders\Models\Order;

public function handle(OrderPlaced $event): void
{
    $order = Order::with('items.product.supplier')->find($event->orderId);
    UsageRecord::create(['amount' => $order->items->sum('total')]);
}
```

**Correct (identity in, DTO out, own model written):**

```php
// Domain/Orders/Events/OrderPlaced.php — carries identities only
final readonly class OrderPlaced
{
    public function __construct(public TenantId $tenantId, public OrderId $orderId) {}
}

// Domain/Billing/Listeners/RecordOrderUsage.php
final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);   // OrderSummaryDTO

        UsageRecord::create([
            'tenant_id' => $event->tenantId->value,
            'amount' => $summary->total->amount,
        ]);
    }
}
```

Enforce in CI:

```bash
grep -rn 'use App\\Domain\\\([A-Za-z]*\)\\\(Models\|Repositories\|Queries\)' app/Domain \
  | awk -F'app/Domain/' '{split($2,p,"/"); split($0,u,"App\\\\Domain\\\\"); if (p[1] != substr(u[2],1,index(u[2],"\\\\")-1)) print}'
```

---

## Use an Open Host Service for Synchronous Cross-Domain Reads

When domain A must synchronously read or command domain B right now, it calls a published contract — the Open Host Service — whose inputs and outputs are DTOs and Value Objects (the Published Language).

- The provider exposes the contract in its own `Contracts/`, returning DTOs, never its Models.
- The consumer type-hints the interface and receives it by constructor injection; the container binds the provider's implementation.
- Data crossing the boundary is identities, never object graphs.

**Incorrect (consumer queries the provider's tables):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Models\Order;

final readonly class UsageCalculatorService
{
    public function monthlyTotal(TenantId $tenant): Money
    {
        return Money::of(Order::where('tenant_id', $tenant->value)->sum('total'));
    }
}
```

**Correct (published contract + DTO):**

```php
// Domain/Orders/Contracts/OrderIntegrationInterface.php  — PUBLIC surface
interface OrderIntegrationInterface
{
    public function orderSummary(OrderId $id): OrderSummaryDTO;

    public function monthlyTotal(TenantId $tenant, DateRange $period): Money;
}

// Domain/Orders/Contracts/OrderSummaryDTO.php — the Published Language
final readonly class OrderSummaryDTO
{
    public function __construct(
        public OrderId $id,
        public OrderStatus $status,
        public Money $total,
        public CarbonImmutable $placedAt,
    ) {}
}

// Domain/Orders/Integration/OrderIntegration.php — implementation, uses Orders' own repository
// Domain/Billing/Services/UsageCalculatorService.php — depends on the interface only
```

Prefer a Domain Event when the interaction is a reaction rather than a question.

---

## A Domain Has a Public Surface and a Private One

Domains are bounded contexts. Each has exactly two surfaces:

- **Private** — `Models/`, `Repositories/`, `Queries/`, internal `Services/`, `Filters/` internals. No other domain may import these, ever.
- **Public** — its `Contracts/` (interfaces and DTOs), its `Events/`, and the Shared Kernel (`app/Support`, `app/Contracts`).

Cross-domain code touches only the public surface.

Note that a Repository interface returns Models, which makes it an *intra*-domain boundary — not the cross-domain surface. Cross-domain reads use a separate DTO-returning contract.

**Incorrect (Billing reaches into Orders' internals):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Models\Order;               // forbidden
use App\Domain\Orders\Repositories\EloquentOrderRepository;  // forbidden

final readonly class UsageCalculatorService
{
    public function chargeFor(Order $order): Money { /* ... */ }
}
```

**Correct (Billing depends on Orders' published contract):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Contracts\OrderIntegrationInterface;

final readonly class UsageCalculatorService
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function chargeFor(OrderId $id): Money
    {
        $summary = $this->orders->orderSummary($id);   // a DTO, not an Order
        // ...
    }
}
```

Pick the integration pattern with `references/inter-domain-decision-guide.md`.

---

## The Shared Kernel Holds Concepts, Never Calls

`app/Support/` and `app/Contracts/` are the Shared Kernel: universal, stable, cross-domain Value Objects, identities and generic interfaces — `Money`, `TenantId`, `UserId`, `DateRange`, `DateRangable`.

It must stay small and stable, contain **no domain behavior**, and change only with cross-domain coordination. It is for shared *primitives*, never a channel for one domain to invoke another.

**Incorrect (domain behavior and a cross-domain call smuggled into the kernel):**

```php
namespace App\Support;

final class OrderHelper
{
    public static function isRefundable(int $orderId): bool
    {
        return \App\Domain\Orders\Models\Order::find($orderId)?->status === 'paid';
    }
}
```

**Correct (pure, universal, no domain knowledge):**

```php
namespace App\Support;

final readonly class Money
{
    public function __construct(public int $minorUnits, public string $currency) {}

    public function plus(Money $other): self
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException('Cannot add different currencies.');
        }

        return new self($this->minorUnits + $other->minorUnits, $this->currency);
    }
}

final readonly class TenantId
{
    public function __construct(public int $value) {}
}
```

Refundability is an Orders rule and stays in Orders.

---

# 9. Configuration and Environments

**Impact: MEDIUM**

Secrets live in `.env`, structure lives in `config/*.php`, and `env()` is never called outside `config/`. Getting this wrong breaks the moment you run `config:cache`.

---

## Cache Config, Routes and Events in Production

Production deploys run the caching commands after installing dependencies. Skipping them costs a measurable amount of work on every request; running them without the discipline in `rules/config-never-env-outside-config.md` breaks the app.

Caches are build artefacts: rebuild on deploy, never commit them.

**Incorrect (deploy script that only migrates):**

```bash
composer install --no-dev
php artisan migrate --force
php artisan queue:restart
```

**Correct:**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force

php artisan config:cache
php artisan route:cache      # requires no closure-based routes
php artisan event:cache
php artisan view:cache
# or, all of the above:
# php artisan optimize

php artisan queue:restart    # workers must reload the new code
```

Two consequences to respect:

- `route:cache` fails on closure routes — every route must point at a controller class.
- Long-lived workers keep the old code in memory until `queue:restart`, so it belongs in every deploy.

Clear caches in local development with `php artisan optimize:clear`.

---

## Never Call env() Outside config

Once `php artisan config:cache` runs in production, the `.env` file is not loaded. Every `env()` call outside `config/*.php` returns `null` — silently, at runtime, only in production.

Read configuration through `config()` everywhere else.

**Incorrect (works locally, returns null in production):**

```php
final readonly class AiProviderRouterService
{
    public function resolveFor(Tenant $tenant): AiProviderInterface
    {
        return env('CHAT_PROVIDER') === 'openai' ? new OpenAiProvider() : new OllamaProvider();
    }
}
```

**Correct:**

```php
// config/chat.php
'provider' => env('CHAT_PROVIDER', 'openai'),
```

```php
final readonly class AiProviderRouterService
{
    public function resolveFor(Tenant $tenant): AiProviderInterface
    {
        return config('chat.provider') === 'openai' ? new OpenAiProvider() : new OllamaProvider();
    }
}
```

Guard it in CI:

```bash
grep -rn '\benv(' app routes database --include='*.php' && exit 1 || exit 0
```

---

## Override Configuration per Environment, Not per Branch

Differences between environments belong in environment variables and `phpunit.xml`, not in `if (app()->environment())` branches scattered through the code. A conditional in application code is a code path that production never exercises until it fails.

Reserve `app()->environment()` for genuinely environment-shaped concerns (registering a debug-only provider, seeding demo data).

**Incorrect (environment branching inside domain code):**

```php
final readonly class SubmitPromptAction
{
    public function handle(SubmitPromptData $data): Message
    {
        $provider = app()->environment('production')
            ? new OpenAiProvider()
            : new FakeProvider();     // production runs untested code
        // ...
    }
}
```

**Correct (one path, configuration decides the binding):**

```php
// config/chat.php
'provider' => env('CHAT_PROVIDER', 'openai'),

// app/Providers/DomainServiceProvider.php
$this->app->bind(AiProviderInterface::class, match (config('chat.provider')) {
    'openai' => OpenAiProvider::class,
    'ollama' => OllamaProvider::class,
    'fake' => FakeProvider::class,
});
```

```xml
<!-- phpunit.xml -->
<env name="CHAT_PROVIDER" value="fake"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
```

---

## Secrets in .env, Structure in config

`.env` holds per-environment values and secrets. `config/*.php` holds structure, defaults and anything derived. Application code reads `config()`, never `env()`.

Every new integration gets its own config file with sensible defaults, so a missing environment variable fails loudly at boot rather than silently at runtime.

**Incorrect (secret in the repo, structure in the environment):**

```php
// config/services.php
'openai' => ['key' => 'sk-live-abc123'],          // committed secret

// .env
CHAT_MODEL_MAP={"pro":"gpt-5","free":"haiku"}     // structure in a string
```

**Correct:**

```php
// config/chat.php
return [
    'provider' => env('CHAT_PROVIDER', 'openai'),
    'api_key' => env('CHAT_API_KEY'),
    'models' => [
        'pro' => 'claude-opus-5',
        'free' => 'claude-haiku-4-5-20251001',
    ],
    'vector_search' => (bool) env('CHAT_VECTOR_SEARCH', false),
];
```

```php
// .env — secret and environment switch only
CHAT_API_KEY=sk-...
CHAT_VECTOR_SEARCH=true
```

Cast in the config file, not at the call site — `config('chat.vector_search')` should already be a bool.

---
