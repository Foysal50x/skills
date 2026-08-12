---
title: Use Configuration for Deployable Variation
impact: MEDIUM
impactDescription: keeps environment and integration choices out of business workflows
tags: config, dependency-injection, extensibility, environments
---

## Use Configuration for Deployable Variation

Put deploy-time choices in `config/*.php`: provider keys, generator classes, formats, endpoints and feature switches. Keep request-time or business decisions as explicit inputs, and resolve configured implementations at the composition boundary through a contract or an injected registry; do not scatter `env()`, environment branches or `new` conditionals through Actions and domain code.

**Incorrect (the workflow owns deployment choices):**

```php
final readonly class RecordPaymentAction
{
    public function handle(PaymentData $data): Payment
    {
        $gateway = app()->environment('production')
            ? new StripeGateway(env('STRIPE_KEY'))
            : new FakeGateway;

        return $gateway->charge($data);
    }
}
```

**Correct (config selects the implementation; the Action sees a contract):**

```php
// config/payments.php
return [
    'gateway' => env('PAYMENT_GATEWAY', 'stripe'),
    'providers' => [
        'stripe' => ['class' => StripeGateway::class, 'key' => env('STRIPE_KEY')],
        'fake' => ['class' => FakeGateway::class],
    ],
];
```

```php
// DomainServiceProvider::register()
$this->app->bind(PaymentGateway::class, function ($app): PaymentGateway {
    $provider = config('payments.providers.'.config('payments.gateway'));

    return $app->make($provider['class']);
});
```

```php
final readonly class RecordPaymentAction
{
    public function __construct(private PaymentGateway $gateway) {}

    public function handle(PaymentData $data): Payment
    {
        return $this->gateway->charge($data);
    }
}
```

Secrets stay in `.env`, read only from `config/` — `rules/config-never-env-outside-config.md`. Validate configured keys and credentials at boot. A configured class name is a seam only when the contract is real: run `rules/gate-earn-extension-seam.md` first, and do not turn every constant into configuration.
