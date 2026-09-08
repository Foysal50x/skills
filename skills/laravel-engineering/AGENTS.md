# laravel-engineering

Laravel implementation discipline for tracing context, reusing present contracts, keeping code simple, preserving failures, and verifying the changed critical path. Use when implementing, refactoring, debugging or reviewing Laravel code where callers, configuration, data flow or proof of correctness may be unclear.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. Context and Contracts

**Impact: CRITICAL**

A change starts with the contract already in the repository: local instructions, callers, configuration, data shape and tests. Read enough of that path to know what must remain true before editing.

---

## Read the Local Contract Before Changing Code

Before editing, read the nearest instructions, the implementation, its direct callers, the configuration it reads and the test that proves its present contract. Search before creating a helper or a second implementation; a locally plausible change can still break a boundary the file does not show.

**Incorrect (changes only the visible method):**

```php
final class RefundOrderAction
{
    public function handle(Order $order): void
    {
        $order->update(['status' => OrderStatus::Refunded]);
    }
}
```

**Correct (uses the existing state transition that owns its invariants):**

```php
final class RefundOrderAction
{
    public function handle(Order $order): void
    {
        $order->markRefunded();
    }
}
```

Read `laravel-patterns` before choosing a new class, `laravel-rest-api` when the caller is HTTP, and `laravel-eloquent` when the change affects data access.

---

## Trace Data and Effects Across the Whole Path

Trace the changed value from input through validation, domain logic, persistence and every emitted effect. Establish who owns validation, authorization and each transition before moving logic; a field name or model relationship is not proof of permission or lifecycle.

**Incorrect (the controller mutates state before the domain contract runs):**

```php
public function cancel(Order $order): Response
{
    $order->update(['status' => OrderStatus::Cancelled]);

    return response()->noContent();
}
```

**Correct (the Action owns the transition and its effects):**

```php
public function __invoke(CancelOrderRequest $request, Order $order, CancelOrderAction $action): Response
{
    $action->handle($order, $request->reason());

    return response()->noContent();
}
```

Use `laravel-rest-api` for the request boundary and `laravel-async` for effects that must happen after persistence commits.

---

# 2. Design and Reuse

**Impact: HIGH**

Prefer the smallest readable implementation that reuses a present abstraction. A new seam, constant or layer must serve a consumer that exists today.

---

## Reuse a Present Contract Before Adding an Abstraction

Reuse an existing domain operation when it already owns the behavior. Extract a shared implementation only when two current consumers need the same stable contract; do not introduce an interface, registry, factory or generic helper for a hypothetical caller.

**Incorrect (duplicates an existing transition):**

```php
final class CancelSubscriptionAction
{
    public function handle(Subscription $subscription): void
    {
        $subscription->update(['status' => SubscriptionStatus::Cancelled]);
    }
}
```

**Correct (delegates to the existing owner):**

```php
final class CancelSubscriptionAction
{
    public function handle(Subscription $subscription): void
    {
        $subscription->cancel();
    }
}
```

Use the `laravel-patterns` Decision Gate before adding a layer or configurable extension seam.

---

## Prefer Direct Readable Code Over One-Off Indirection

Write the smallest direct code that makes the current business decision clear. Name a constant when it expresses a reusable invariant; keep a one-use literal beside the decision when extracting it makes the reader search for meaning.

**Incorrect (a one-use constant hides the decision):**

```php
final class ExpireInvitationAction
{
    private const EXPIRY_DAYS = 7;

    public function handle(Invitation $invitation): void
    {
        $invitation->update(['expires_at' => now()->addDays(self::EXPIRY_DAYS)]);
    }
}
```

**Correct (the policy is visible where it is applied):**

```php
final class ExpireInvitationAction
{
    public function handle(Invitation $invitation): void
    {
        $invitation->update(['expires_at' => now()->addDays(7)]);
    }
}
```

Reuse a named policy, enum or configuration value when it already exists; do not replace a real shared contract with a duplicate literal.

---

# 3. Correctness and Failure

**Impact: CRITICAL**

Fix the condition that creates a failure, preserve errors, and make writes observable through the read shape their consumers use. Correctness comes from explicit guarantees, not incidental order or state.

---

## Fix the Cause and Preserve the Error

Correct the condition that makes a failure possible rather than adding a fallback that masks it. Catch an error only to add actionable context or translate it at a defined boundary; never continue to write data after an operation failed or after a failed lookup was silently replaced.

**Incorrect (continues after payment collection failed):**

```php
try {
    $gateway->charge($invoice);
} catch (PaymentException) {
}

$invoice->markPaid();
```

**Correct (the failed operation prevents the invalid write):**

```php
$gateway->charge($invoice);

$invoice->markPaid();
```

Use a context-specific exception when the HTTP or queue boundary needs a deliberate translation; see `laravel-rest-api` and `laravel-async`.

---

## Read Back Through the Consumer Shape

After a write, return or reload the shape the immediate consumer actually reads. Build on an explicit invariant such as a database constraint, model transition or query contract; do not rely on an in-memory model, observer timing or a relation that happened to be loaded.

**Incorrect (returns an instance whose customer relation is incidental):**

```php
$order = Order::create($data);

return new OrderResource($order);
```

**Correct (loads the resource contract explicitly):**

```php
$order = Order::create($data)->load('customer');

return new OrderResource($order);
```

For a multi-step write, use `laravel-eloquent` transactions and dispatch effects through `laravel-async` after commit.

---

# 4. Hygiene and Verification

**Impact: HIGH**

Keep changed code and operational documentation current, remove dead code, and prove the risk-bearing path without adding framework or implementation-detail tests.

---

## Keep Code Self-Explanatory and Live

Prefer names, types and structure over comments that merely restate an implementation detail. Keep PHPDoc used by PHPStan or Larastan, framework annotations, and file or boundary labels that orient a reader in a multi-file example. Keep only code, configuration and dependencies with a consumer today; delete an unused branch, helper or import instead of preserving it for a possible future need.

**Incorrect (a comment restates the method body and an unused branch remains):**

```php
public function markPaid(Order $order): void
{
    // Mark the order as paid.
    $order->markPaid();
}

if (false) {
    $order->sendLegacyReminder();
}
```

**Correct (the method name carries the behavior and only live code remains):**

```php
public function markPaid(Order $order): void
{
    $order->markPaid();
}
```

Do not remove a PHPDoc contract or a file-reference label merely because it is a comment. Keep documentation and configuration references synchronized with the deployed behavior.

---

## Verify Critical Paths and Synchronize Documentation

Verify the changed behavior at its highest-risk boundary: authorization, state transition, persistence, external effect or response contract. Add a focused test for that decision, not framework behavior or every branch; when configuration, operations or public behavior changes, update the documentation in the same change and read it back against the implementation.

**Incorrect (tests a framework write instead of the business decision):**

```php
it('creates an order', function (): void {
    $order = Order::factory()->create();

    expect($order)->toBeInstanceOf(Order::class);
});
```

**Correct (tests the authorization boundary that protects the write):**

```php
it('rejects a user from another tenant', function (): void {
    $response = $this->actingAs($otherTenantUser)->postJson(route('orders.store'), validOrderPayload());

    $response->assertForbidden();
});
```

Use `laravel-testing` to choose the test type, and verify configuration through the same boot or command path production uses.

---
