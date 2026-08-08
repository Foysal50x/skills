# Test Templates by Layer

Copy-paste starting points. All examples use Pest.

## A — Action or Service, faked repository, no database

```php
it('builds context from recent and relevant messages', function (): void {
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

## B — Repository or Query Class, real database

```php
uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->repository = app(OrderRepositoryInterface::class);
});

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

## C — Value Object, pure

```php
it('treats a null bound as open-ended', function (?string $from, ?string $to, string $date, bool $expected): void {
    $range = new DateRange(
        $from === null ? null : CarbonImmutable::parse($from),
        $to === null ? null : CarbonImmutable::parse($to),
    );

    expect($range->covers(CarbonImmutable::parse($date)))->toBe($expected);
})->with([
    [null, '2026-03-31', '2020-01-01', true],
    ['2026-03-01', null, '2030-01-01', true],
    ['2026-03-01', '2026-03-31', '2026-02-28', false],
]);
```

## D — Feature test, authorization

```php
it('rejects a user from another merchant', function (): void {
    $order = Order::factory()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])
        ->assertForbidden();

    expect($order->fresh()->note)->toBeNull();
});
```

## E — Feature test, payload contract

```php
it('returns the documented order shape', function (): void {
    $order = Order::factory()->for($merchant)->create(['number' => 'A-1']);

    $this->actingAs($merchant->owner)
        ->getJson("/api/orders/{$order->id}")
        ->assertOk()
        ->assertJsonStructure(['data' => ['id', 'number', 'status', 'total' => ['amount', 'currency']]])
        ->assertJsonPath('data.number', 'A-1')
        ->assertJsonMissingPath('data.payment_token');
});
```

## F — Job idempotency

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

## G — Query count regression guard

```php
it('renders the order list in a constant number of queries', function (): void {
    Order::factory()->count(20)->hasItems(3)->create();

    $queries = 0;
    DB::listen(function () use (&$queries): void { $queries++; });

    $this->getJson('/api/orders')->assertOk();

    expect($queries)->toBeLessThanOrEqual(4);
});
```

## H — Cache invalidation

```php
it('clears the merchant stats cache when an order is saved', function (): void {
    $order = Order::factory()->create();
    Cache::tags(["merchant:{$order->merchant_id}"])->put('probe', 'value', 600);

    $order->update(['total' => 500]);

    expect(Cache::tags(["merchant:{$order->merchant_id}"])->get('probe'))->toBeNull();
});
```
