# laravel-testing

Test strategy for a layered Laravel application — which test style fits each layer, hand-written fakes over mocks, real-database tests for Query Classes and Repositories, pure tests for Value Objects, and feature tests that assert authorization, payload shape and query counts. Use when writing or reviewing Laravel tests, deciding what to fake, diagnosing a flaky or slow suite, or setting a project's testing conventions.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. Strategy by Layer

**Impact: HIGH**

Each architectural layer has one test style that fits it. Testing an Action against a real database, or a Query Class against a mock, produces slow suites that prove little.

---

## If the Test Feels Silly, the Class Was Not Needed

Writing a test for a Query Class and finding there is nothing to assert beyond "it calls `find()`" means the class did not earn its existence. The same goes for a Service with one caller and no decision, or a Value Object wrapping one scalar.

The difficulty of writing a meaningful test is a design signal. Listen to it and delete the class.

**Incorrect (a test that restates the implementation):**

```php
it('finds an article by id', function (): void {
    $article = Article::factory()->create();

    expect((new FindArticleByIdQuery())->handle($article->id)->is($article))->toBeTrue();
});
// This tests Eloquent's find(). The query class should not exist.
```

**Correct (the query encodes rules worth asserting):**

```php
it('returns only pending orders older than the cutoff, oldest first', function (): void {
    $old = Order::factory()->pending()->create(['created_at' => now()->subHours(5)]);
    $newer = Order::factory()->pending()->create(['created_at' => now()->subHours(3)]);
    Order::factory()->pending()->create(['created_at' => now()->subMinutes(10)]);   // too recent
    Order::factory()->paid()->create(['created_at' => now()->subHours(5)]);         // wrong status

    $results = app(OrderRepositoryInterface::class)->abandonedSince(now()->subHours(2));

    expect($results->pluck('id')->all())->toBe([$old->id, $newer->id]);
});
```

The converse also holds: a class that is hard to test because it needs five collaborators and a database is usually doing more than one thing.

---

## Match the Test Style to the Layer

Each layer has one style that fits it. Using the wrong one gives you a slow suite that breaks on refactors and misses real bugs.

| Layer | Style | Database | What it proves |
|-------|-------|----------|----------------|
| **Action** | Unit, with a fake repository | No | The use case orchestrates correctly |
| **Service** | Unit, with fakes | No | The business decision is right |
| **Repository** | Integration, real DB + factories | Yes | Methods return the right domain types |
| **Query Class** | Integration, real DB + factories | Yes | Which rows are in, which are out, in what order |
| **Value Object** | Pure unit | No | Predicates and transformations |
| **Controller / route** | Feature test | Usually | Status, payload shape, authorization |
| **Job / Listener** | Unit for the handler, fake for dispatch | Depends | Idempotency and effects |

**Incorrect (an Action test that boots a database to prove orchestration):**

```php
uses(RefreshDatabase::class);

it('submits a prompt', function (): void {
    $conversation = Conversation::factory()->hasMessages(20)->create();

    $message = app(SubmitPromptAction::class)->handle(new SubmitPromptData($conversation->id, 'hi'));

    expect($message->content)->not->toBeEmpty();
});
// Slow, and it fails when the query changes rather than when the orchestration does.
```

**Correct (fake the boundary, no database):**

```php
it('builds context from recent and relevant messages', function (): void {
    $chat = new class implements ChatRepositoryInterface {
        public function recentMessages(Conversation $c, int $limit = 20): Collection
        {
            return collect([new Message(['content' => 'recent'])]);
        }

        public function relevantMessages(Conversation $c, string $prompt, int $limit = 10): Collection
        {
            return collect([new Message(['content' => 'relevant context'])]);
        }
    };

    $context = (new ConversationContextService($chat))->buildContextFor(new Conversation(), 'a question');

    expect($context)->toContain('relevant context');
});
```

---

## Keep the Suite Fast Enough to Run on Every Save

A test suite is only useful at the frequency people run it. Two structural choices do most of the work: keep unit tests free of the database, and give the integration tests a fast database.

Use `RefreshDatabase` (transaction rollback) rather than `DatabaseMigrations` (re-migrate per test). Run tests in parallel. Fake external services rather than hitting them.

**Incorrect (every test migrates from scratch and boots the full application):**

```php
uses(DatabaseMigrations::class);   // re-runs every migration, per test

it('formats a date range label', function (): void {
    expect((new DateRange(now()->subDay(), now()))->isBounded())->toBeTrue();
});
// A pure predicate paying a full migration.
```

**Correct:**

```php
// tests/Pest.php
uses(Tests\TestCase::class, RefreshDatabase::class)->in('Feature', 'Integration');
uses(Tests\TestCase::class)->in('Unit');           // no database at all
```

```xml
<!-- phpunit.xml -->
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
<env name="MAIL_MAILER" value="array"/>
```

```bash
php artisan test --parallel
php artisan test --dirty          # only what changed, during development
```

One caveat on SQLite: it does not behave identically to MySQL or Postgres for JSON operators, full-text search, locking or strict-mode errors. Run the integration suite against the production engine in CI even if local runs use SQLite.

---

## Test Your Rules, Not Eloquent

Laravel is tested. A test asserting that `create()` writes a row, that `belongsTo()` resolves, or that a cast returns a `Carbon` proves nothing about your application and breaks on upgrades.

Test the decisions you made: which rows a filter includes and excludes, what order results come back in, what the default is when input is missing, which relations are eager-loaded.

**Incorrect (asserting framework behavior):**

```php
it('creates an order', function (): void {
    $order = Order::factory()->create(['number' => 'A-1']);

    expect($order->number)->toBe('A-1')
        ->and(Order::count())->toBe(1);
});

it('casts status to an enum', function (): void {
    expect(Order::factory()->create(['status' => 'paid'])->status)->toBeInstanceOf(OrderStatus::class);
});
```

**Correct (asserting your query's rules):**

```php
it('excludes orders outside the date range and other merchants', function (): void {
    $merchant = Merchant::factory()->create();

    $included = Order::factory()->for($merchant)->create(['created_at' => now()->subDays(2)]);
    Order::factory()->for($merchant)->create(['created_at' => now()->subMonths(3)]);  // out of range
    Order::factory()->create(['created_at' => now()->subDays(2)]);                    // other merchant

    $results = app(OrderRepositoryInterface::class)->searchOrders(new OrderQueryFilter(
        merchantId: $merchant->id,
        dateRange: (new ThisMonth())->range(),
    ));

    expect($results)->toHaveCount(1)
        ->and($results->first()->is($included))->toBeTrue();
});
```

Always assert exclusions. A filter test that only checks the included row passes when the filter is missing entirely.

---

# 2. Fakes and Doubles

**Impact: HIGH**

Fake the boundary, not the framework. A hand-written fake implementing your own interface beats a mock of Eloquent every time.

---

## Assert Queued Mail and Notifications With assertQueued()

`Mail::assertSent()` inspects messages sent synchronously. A `Mailable` that implements `ShouldQueue` is never sent that way, so the assertion fails — and the usual reaction is to delete `ShouldQueue` until the test goes green, which puts SMTP back in the request.

Match the assertion to how the message is dispatched: `assertQueued()` for `ShouldQueue`, `assertSent()` for everything else.

**Incorrect (the assertion is wrong, and the class gets "fixed"):**

```php
it('emails the statement', function (): void {
    Mail::fake();

    (new CloseBillingPeriodAction)->handle($account);

    Mail::assertSent(StatementReady::class);   // StatementReady implements ShouldQueue
});
```

**Correct:**

```php
it('queues the statement email', function (): void {
    Mail::fake();
    Notification::fake();

    (new CloseBillingPeriodAction)->handle($account);

    Mail::assertQueued(
        StatementReady::class,
        fn (StatementReady $mail): bool => $mail->hasTo($account->billingEmail),
    );

    Notification::assertSentTo($account->owner, InvoicePaid::class);
});
```

`Notification::fake()` records queued and unqueued notifications alike, so `assertSentTo()` is right either way — the split only affects mail.

Keep content assertions separate: build the mailable directly and use `assertSeeInHtml()` in its own test. A test that asserts both dispatch and wording breaks twice for one copy change.

---

## Fake Framework Boundaries With the Built-In Fakes

Laravel's fakes record calls instead of performing them, and give you assertions over what was recorded. Use them for anything that leaves the process.

`Queue::fake()`, `Bus::fake()`, `Event::fake()`, `Mail::fake()`, `Notification::fake()`, `Storage::fake()`, `Http::fake()`.

**Incorrect (relies on `sync` and actually performs the work):**

```php
it('places an order', function (): void {
    $this->postJson('/api/orders', $payload)->assertCreated();

    expect(Mail::to(...))->/* no way to assert; the mail was really attempted */;
});
```

**Correct:**

```php
it('queues confirmation and usage recording when an order is placed', function (): void {
    Event::fake([OrderPlaced::class]);

    $order = app(PlaceOrderAction::class)->handle($data);

    Event::assertDispatched(OrderPlaced::class, fn (OrderPlaced $e) => $e->orderId->value === $order->id);
});
```

```php
it('dispatches the export to the low queue', function (): void {
    Queue::fake();

    app(PlaceExportAction::class)->handle($user, $filter);

    Queue::assertPushedOn('low', GenerateOrderExport::class);
    Queue::assertPushed(GenerateOrderExport::class, 1);
});
```

```php
it('retries the upstream call', function (): void {
    Http::fake(['upstream.test/*' => Http::sequence()
        ->push(status: 500)
        ->push(['ok' => true], 200)]);

    (new SyncToUpstream($payload))->handle();

    Http::assertSentCount(2);
});
```

`Event::fake()` with no arguments suppresses *every* event, including model events other assertions rely on. Pass the specific classes.

---

## Fake the HTTP Client and Forbid Stray Requests

`Http::fake()` alone only stubs the URLs you remembered. Anything else still leaves the machine: the suite is slow, fails when the provider is down, and can write real data through a forgotten `POST`.

`Http::preventStrayRequests()` turns every unfaked call into a failed test that names the URL — which is how you find the call site you did not know about.

**Incorrect (one endpoint faked, the rest live):**

```php
it('imports the customer', function (): void {
    Http::fake(['api.crm.test/v1/customers/*' => Http::response(['name' => 'Ada'])]);

    (new ImportCustomerAction)->handle(42);   // the address-lookup call still goes out
});
```

**Correct:**

```php
it('imports the customer', function (): void {
    Http::preventStrayRequests();

    Http::fake([
        'api.crm.test/v1/customers/42' => Http::response(['name' => 'Ada', 'postcode' => 'SW1A']),
        'api.post.test/*' => Http::response(['line_1' => '10 Downing St']),
    ]);

    $customer = (new ImportCustomerAction)->handle(42);

    expect($customer->address->line1)->toBe('10 Downing St');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.crm.test/v1/customers/42');
});
```

Test the failure paths too — they are the ones no staging environment reproduces:

```php
Http::fake(['api.crm.test/*' => Http::failedConnection()]);
Http::fake(['api.crm.test/*' => Http::response(['message' => 'slow down'], 429)]);
```

Put `preventStrayRequests()` in the base `TestCase` so a new test cannot opt out by forgetting. See the `laravel-rest-api` skill for the client rules these tests are proving.

---

## Never Mock Eloquent or the Query Builder

Mocking `Model::where()->orderBy()->get()` asserts the exact chain of calls you happened to write. Refactor the query into something equivalent and the test fails; write a query that returns the wrong rows and the test passes. It verifies syntax, not behavior.

Query construction is tested against a real database. Everything above it is tested against your own interface.

**Incorrect:**

```php
$builder = Mockery::mock(Builder::class);
$builder->shouldReceive('where')->with('status', 'pending')->andReturnSelf();
$builder->shouldReceive('orderBy')->with('created_at', 'desc')->andReturnSelf();
$builder->shouldReceive('get')->andReturn(collect([$order]));

Order::shouldReceive('query')->andReturn($builder);
// Passes even if the filter is on the wrong column.
```

**Correct (real database for the query):**

```php
uses(RefreshDatabase::class);

it('returns pending orders newest first', function (): void {
    $older = Order::factory()->pending()->create(['created_at' => now()->subDay()]);
    $newer = Order::factory()->pending()->create(['created_at' => now()]);
    Order::factory()->paid()->create();

    $results = app(OrderRepositoryInterface::class)->pendingOrders();

    expect($results->pluck('id')->all())->toBe([$newer->id, $older->id]);
});
```

**Correct (fake interface for everything above):**

```php
$orders = new class implements OrderRepositoryInterface {
    public function pendingOrders(?int $merchantId = null): Collection
    {
        return collect([new Order(['id' => 1])]);
    }
    // ...
};
```

The same applies to `Model::shouldReceive()` via `partialMock` — if you need it, the class under test is doing data access it should have delegated.

---

## Fake a Repository With an Anonymous Class

An anonymous class implementing your Repository interface is the cheapest, clearest double there is: no mocking DSL, no expectation chains, and the compiler tells you when the interface changes.

This is one of the concrete payoffs of a small, focused Repository interface — a three-method interface takes five lines to fake.

**Incorrect (mock chain that breaks on any refactor, and asserts the wrong thing):**

```php
$repo = Mockery::mock(ChatRepositoryInterface::class);
$repo->shouldReceive('recentMessages')->once()->with(Mockery::type(Conversation::class), 20)
     ->andReturn(collect());
$repo->shouldReceive('relevantMessages')->once()->andReturn(collect([$message]));
// Asserts how the Service calls the repository, not what it produces.
```

**Correct:**

```php
it('includes relevant context in the prompt', function (): void {
    $chat = new class implements ChatRepositoryInterface {
        public function recentMessages(Conversation $conversation, int $limit = 20): Collection
        {
            return collect([new Message(['content' => 'earlier turn'])]);
        }

        public function relevantMessages(Conversation $conversation, string $prompt, int $limit = 10): Collection
        {
            return collect([new Message(['content' => 'relevant context'])]);
        }
    };

    $context = (new ConversationContextService($chat))->buildContextFor(new Conversation(), 'a new question');

    expect($context)->toContain('relevant context')
        ->and($context)->toContain('earlier turn');
});
```

```php
// Bind it when the class under test resolves the interface from the container:
$this->app->bind(ChatRepositoryInterface::class, fn () => $chat);
```

For a fake reused across many tests, promote it to `tests/Fakes/InMemoryChatRepository.php` with settable state.

---

## Freeze Time and Seed Randomness

A test that depends on the wall clock fails at midnight, at month boundaries, or when CI is slow. `Carbon::setTestNow()` — or Laravel's `travelTo()` / `freezeTime()` — makes time an input rather than an ambient condition.

The same applies to anything random: seed it, or assert the shape rather than the value.

**Incorrect (passes most days):**

```php
it('includes this month\'s orders', function (): void {
    $order = Order::factory()->create(['created_at' => now()->subDays(3)]);

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: (new ThisMonth())->range()));

    expect($results)->toHaveCount(1);
});
// Fails on the 1st and 2nd of every month.
```

**Correct:**

```php
it('includes this month\'s orders', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-03-15 10:00:00'));

    $inRange = Order::factory()->create(['created_at' => '2026-03-12 09:00:00']);
    Order::factory()->create(['created_at' => '2026-02-28 23:59:00']);   // previous month

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: (new ThisMonth())->range()));

    expect($results->pluck('id')->all())->toBe([$inRange->id]);
});
```

```php
// Freeze without moving, when only stability matters:
$this->freezeTime();

// Testing an expiry window:
$this->travel(3)->hours();
```

Time travel is undone automatically at the end of each test. Set the timezone explicitly in any test involving day boundaries.

---

# 3. Database Tests

**Impact: HIGH**

Query Classes and Repositories are tested against a real database with factories. Test your query rules — which rows are in, which are out, in what order — not Eloquent itself.

---

## Assert What Is Excluded, Not Only What Is Included

A test that creates one matching row and asserts it comes back passes when the filter does nothing at all. Every filter test needs at least one row that must be excluded, for each condition.

Create one row per boundary: wrong tenant, wrong status, outside the date range, soft-deleted.

**Incorrect (passes with no filter in the query at all):**

```php
it('filters by merchant', function (): void {
    $merchant = Merchant::factory()->create();
    Order::factory()->for($merchant)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter(merchantId: $merchant->id)))
        ->toHaveCount(1);
});
```

**Correct (a negative case per condition):**

```php
it('filters by merchant, status and date range', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-03-15'));
    $merchant = Merchant::factory()->create();

    $included = Order::factory()->for($merchant)->pending()->create(['created_at' => '2026-03-10']);

    Order::factory()->for($merchant)->paid()->create(['created_at' => '2026-03-10']);      // status
    Order::factory()->for($merchant)->pending()->create(['created_at' => '2026-01-10']);   // date
    Order::factory()->pending()->create(['created_at' => '2026-03-10']);                   // merchant

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        merchantId: $merchant->id,
        status: OrderStatus::Pending,
        dateRange: (new ThisMonth())->range(),
    ));

    expect($results->pluck('id')->all())->toBe([$included->id]);
});
```

Asserting the exact id list rather than a count also catches a filter that includes the right number of wrong rows.

---

## RefreshDatabase Plus Factories, Never Shared Fixtures

`RefreshDatabase` wraps each test in a transaction and rolls back, so tests do not leak into each other. Factories build exactly the rows a test needs, in the test that needs them.

A shared seeder used by many tests is a hidden dependency: reading the test does not tell you why it passes, and changing the seeder breaks unrelated tests.

**Incorrect (preconditions live somewhere else):**

```php
beforeEach(fn () => $this->seed(DemoDataSeeder::class));   // 400 rows, unknown shape

it('returns pending orders', function (): void {
    expect($this->repository->pendingOrders())->toHaveCount(7);
    // Why 7? Nobody knows. Add a row to the seeder and this breaks.
});
```

**Correct:**

```php
uses(RefreshDatabase::class);

it('returns pending orders for the given merchant', function (): void {
    $merchant = Merchant::factory()->create();

    Order::factory()->for($merchant)->pending()->count(2)->create();
    Order::factory()->for($merchant)->paid()->create();
    Order::factory()->pending()->create();                    // different merchant

    expect($this->repository->pendingOrders($merchant->id))->toHaveCount(2);
});
```

```php
// Model-specific states keep the intent readable:
class OrderFactory extends Factory
{
    public function pending(): static
    {
        return $this->state(['status' => OrderStatus::Pending, 'paid_at' => null]);
    }
}
```

Reserve seeders for reference data the whole suite needs — currencies, plans, permissions — and load it once via `RefreshDatabase::$seed`.

---

## Assert the Query Eager-Loads What the Resource Reads

An eager load added to fix an N+1 is one refactor away from being dropped. Two ways to hold it: assert the relation is loaded, or count queries on the endpoint.

Counting queries is the stronger test because it catches loads added later by a different path.

**Incorrect (nothing prevents the `with()` being removed):**

```php
it('returns orders', function (): void {
    Order::factory()->count(5)->hasItems(3)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter()))->toHaveCount(5);
});
```

**Correct (assert the relations are loaded):**

```php
it('eager-loads the relations the resource renders', function (): void {
    Order::factory()->hasItems(2)->create();

    $order = $this->repository->searchOrders(new OrderQueryFilter())->first();

    expect($order->relationLoaded('customer'))->toBeTrue()
        ->and($order->relationLoaded('items'))->toBeTrue();
});
```

**Correct (count queries on the endpoint):**

```php
it('renders the order list in a constant number of queries', function (): void {
    Order::factory()->count(20)->hasItems(3)->create();

    $queries = 0;
    DB::listen(function () use (&$queries): void { $queries++; });

    $this->getJson('/api/orders')->assertOk();

    expect($queries)->toBeLessThanOrEqual(4);
});
```

With `Model::preventLazyLoading()` enabled in the test environment, a missing eager load throws rather than degrading — which makes these assertions a second line of defence rather than the only one.

---

## Test Ordering, Defaults and the Sort Allow-List

Three query rules that count assertions never reach: the order rows come back in, the default applied when no input is given, and what happens when the sort column is not on the allow-list.

The last one is a security test — an unwhitelisted column reaching `orderBy` is an injection surface.

**Incorrect (order and defaults untested):**

```php
it('searches orders', function (): void {
    Order::factory()->count(3)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter()))->toHaveCount(3);
});
```

**Correct:**

```php
it('defaults to newest first when no sort is supplied', function (): void {
    $old = Order::factory()->create(['created_at' => now()->subDays(2)]);
    $new = Order::factory()->create(['created_at' => now()]);

    $results = $this->repository->searchOrders(new OrderQueryFilter());

    expect($results->pluck('id')->all())->toBe([$new->id, $old->id]);
});

it('sorts by an allow-listed column', function (): void {
    $b = Order::factory()->create(['number' => 'B-2']);
    $a = Order::factory()->create(['number' => 'A-1']);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        sorting: new Sorting('number', Direction::Asc),
    ));

    expect($results->pluck('id')->all())->toBe([$a->id, $b->id]);
});

it('falls back to the default order when the sort column is not allow-listed', function (): void {
    $old = Order::factory()->create(['created_at' => now()->subDay()]);
    $new = Order::factory()->create(['created_at' => now()]);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        sorting: new Sorting('password', Direction::Asc),
    ));

    expect($results->pluck('id')->all())->toBe([$new->id, $old->id]);
});
```

---

## Test Rollback and Repeat-Safety Explicitly

Two properties are assumed everywhere and asserted almost nowhere: that a failing multi-step write leaves nothing behind, and that a queued handler run twice produces the same state as running it once.

Both are one short test each.

**Incorrect (the happy path only):**

```php
it('places an order', function (): void {
    $order = app(PlaceOrderAction::class)->handle($data);

    expect($order->status)->toBe(OrderStatus::Pending);
});
```

**Correct (rollback):**

```php
it('leaves no partial state when reserving stock fails', function (): void {
    $product = Product::factory()->create(['stock' => 0]);

    expect(fn () => app(PlaceOrderAction::class)->handle($dataFor($product)))
        ->toThrow(StockException::class);

    expect(Order::count())->toBe(0)
        ->and(OrderItem::count())->toBe(0)
        ->and($product->fresh()->stock)->toBe(0);
});
```

**Correct (idempotency):**

```php
it('charges the order only once when the job runs twice', function (): void {
    $order = Order::factory()->pending()->create();
    $gateway = new FakePaymentGateway();

    (new ChargeOrder($order->id))->handle($gateway);
    (new ChargeOrder($order->id))->handle($gateway);

    expect($order->fresh()->status)->toBe(OrderStatus::Paid)
        ->and($gateway->chargeCount)->toBe(1);
});
```

Note that `RefreshDatabase` wraps the test in its own transaction, so a nested `DB::transaction()` rollback still works — but `DB::afterCommit()` callbacks will not fire until the outer test transaction ends. Assert the dispatch with `Queue::fake()` rather than the side effect.

---

# 4. Feature Tests

**Impact: MEDIUM-HIGH**

Feature tests cover the edge: status codes, payload shape, authorization, and the query count of hot endpoints.

---

## Every Protected Endpoint Has an Authorization Test

The happy-path test passes whether or not the endpoint is protected. Authorization needs its own cases: unauthenticated, authenticated but not permitted, and — for tenant-scoped data — permitted for someone else's record.

The third case is the one that catches insecure direct object references.

**Incorrect (only the permitted user is tested):**

```php
it('updates an order', function (): void {
    $order = Order::factory()->create();

    $this->actingAs($order->merchant->owner)
        ->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])
        ->assertOk();
});
```

**Correct (three cases, one per failure mode):**

```php
it('rejects unauthenticated requests', function (): void {
    $order = Order::factory()->create();

    $this->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])->assertUnauthorized();
});

it('rejects a user from another merchant', function (): void {
    $order = Order::factory()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])
        ->assertForbidden();

    expect($order->fresh()->note)->toBeNull();
});

it('scopes nested bindings to the parent', function (): void {
    $conversation = Conversation::factory()->create();
    $foreignMessage = Message::factory()->create();          // different conversation

    $this->actingAs($conversation->user)
        ->getJson("/api/conversations/{$conversation->id}/messages/{$foreignMessage->id}")
        ->assertNotFound();
});
```

Assert the state did not change, not only the status code — a 403 returned after the write has already happened is still a bug.

---

## Assert the Payload Shape, Not Just the Status

`assertOk()` passes for any body. Since the Resource is the API contract, the test should pin its shape — the keys, their types, and that nothing extra leaked.

`assertJsonStructure` catches missing keys. Add an explicit check for keys that must *not* appear.

**Incorrect:**

```php
it('returns an order', function (): void {
    $order = Order::factory()->create();

    $this->actingAs($user)->getJson("/api/orders/{$order->id}")->assertOk();
});
```

**Correct:**

```php
it('returns the documented order shape', function (): void {
    $order = Order::factory()->for($merchant)->create(['number' => 'A-1']);

    $this->actingAs($merchant->owner)
        ->getJson("/api/orders/{$order->id}")
        ->assertOk()
        ->assertJsonStructure([
            'data' => ['id', 'number', 'status', 'total' => ['amount', 'currency'], 'placed_at'],
        ])
        ->assertJsonPath('data.number', 'A-1')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonMissingPath('data.internal_notes')
        ->assertJsonMissingPath('data.payment_token');
});
```

```php
// Validation contracts deserve the same treatment:
it('rejects an empty item list', function (): void {
    $this->actingAs($user)
        ->postJson('/api/orders', ['customer_id' => $customer->id, 'items' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items']);
});
```

`assertJsonMissingPath` on sensitive fields is what turns a Resource allow-list from a convention into an enforced rule.

---

## Assert the Effects an Endpoint Queues

Most of what an endpoint does happens after the response: jobs queued, events dispatched, mail sent. A feature test asserting only the 201 covers a fraction of the behavior.

Fake the boundary and assert what was recorded — including the queue it went to.

**Incorrect (the response is checked, the work is not):**

```php
it('creates an order', function (): void {
    $this->actingAs($user)->postJson('/api/orders', $payload)->assertCreated();
});
```

**Correct:**

```php
it('creates the order and queues its side effects', function (): void {
    Queue::fake();
    Event::fake([OrderPlaced::class]);

    $this->actingAs($user)
        ->postJson('/api/orders', $payload)
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $order = Order::sole();

    Event::assertDispatched(
        OrderPlaced::class,
        fn (OrderPlaced $event) => $event->orderId->value === $order->id,
    );

    Queue::assertPushedOn('high', SendOrderConfirmation::class);
});
```

```php
// And that nothing fires on the failure path:
it('queues nothing when validation fails', function (): void {
    Queue::fake();

    $this->actingAs($user)->postJson('/api/orders', ['items' => []])->assertUnprocessable();

    Queue::assertNothingPushed();
});
```

`Event::fake()` with no arguments suppresses model events too, which can break other assertions — always name the classes.

---

# 5. Value Object Tests

**Impact: MEDIUM**

Value Objects are pure, so their tests are pure — no database, no container, no Builder.

---

## Never Test a Value Object by Handing It a Builder

If a Value Object test needs a `Builder`, the Value Object is building queries — which the architecture forbids. The test is not the problem; the design is.

Value Objects hold data and pure behavior. Query construction lives in Query Classes, and is tested there against a real database.

**Incorrect (the test only compiles because the boundary was broken):**

```php
it('applies the date range to a query', function (): void {
    $query = Order::query();

    (new DateRange(now()->subDays(3), now()))->apply($query, 'created_at');

    expect($query->toSql())->toContain('created_at >=');
});
// DateRange::apply(Builder) should not exist.
```

**Correct — the Value Object is tested purely:**

```php
it('reports whether a date falls inside the range', function (): void {
    $range = new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31'));

    expect($range->covers(CarbonImmutable::parse('2026-03-15')))->toBeTrue();
});
```

**And the query rule is tested against the database:**

```php
uses(RefreshDatabase::class);

it('excludes orders outside the date range', function (): void {
    $inside = Order::factory()->create(['created_at' => '2026-03-15']);
    Order::factory()->create(['created_at' => '2026-04-02']);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        dateRange: new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31')),
    ));

    expect($results->pluck('id')->all())->toBe([$inside->id]);
});
```

Asserting on `toSql()` is a related smell: it tests the string you generated, not the rows you get back.

---

## Test Value Object Predicates Directly

Value Objects are pure data plus pure predicates and transformations, so their tests need no database, no container and no HTTP. Construct, call, assert.

Because they are cheap, cover the boundaries exhaustively — a datasets block gives you a dozen cases for the price of one test.

**Incorrect (testing the Value Object through a query):**

```php
uses(RefreshDatabase::class);

it('covers dates in range', function (): void {
    Order::factory()->create(['created_at' => now()->subDay()]);

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: new DateRange(now()->subDays(3), now())));

    expect($results)->toHaveCount(1);
});
// A slow, indirect test of DateRange::covers().
```

**Correct:**

```php
it('covers dates inside the range', function (): void {
    $range = new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31'));

    expect($range->isBounded())->toBeTrue()
        ->and($range->covers(CarbonImmutable::parse('2026-03-15')))->toBeTrue()
        ->and($range->covers(CarbonImmutable::parse('2026-03-01')))->toBeTrue()   // inclusive
        ->and($range->covers(CarbonImmutable::parse('2026-04-01')))->toBeFalse();
});

it('treats a null bound as open-ended', function (?string $from, ?string $to, string $date, bool $expected): void {
    $range = new DateRange(
        $from === null ? null : CarbonImmutable::parse($from),
        $to === null ? null : CarbonImmutable::parse($to),
    );

    expect($range->covers(CarbonImmutable::parse($date)))->toBe($expected);
})->with([
    [null, '2026-03-31', '2020-01-01', true],
    ['2026-03-01', null, '2030-01-01', true],
    [null, null, '2026-03-15', true],
    ['2026-03-01', '2026-03-31', '2026-02-28', false],
]);
```

Named constructors and transformations get the same treatment: `Sorting::latest()`, `DateRange::intersect()`, `LastNMonths(3)->range()`.

---
