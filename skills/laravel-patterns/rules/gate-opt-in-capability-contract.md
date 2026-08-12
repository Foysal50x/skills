---
title: Make Optional Behavior an Opt-In Contract
impact: HIGH
impactDescription: stops a shared interface growing methods most implementations no-op
tags: gate, solid, interfaces, contracts
---

## Make Optional Behavior an Opt-In Contract

When only some implementations need an extra step, publish it as a second contract they opt into instead of widening the shared one. The base checks `instanceof` before paying for it, so a simple implementation stays one method and nobody writes a no-op override that reads like a guarantee.

**Incorrect (every implementation answers a question most of them do not have):**

```php
interface IdGenerator
{
    public function generate(): string;

    public function isUnique(string $id): bool;

    public function maxAttempts(): int;
}

final class StripeStyleGenerator implements IdGenerator
{
    public function generate(): string
    {
        return 'in_'.bin2hex(random_bytes(12));
    }

    public function isUnique(string $id): bool
    {
        return true; // dead code shaped like a promise
    }

    public function maxAttempts(): int
    {
        return 1;
    }
}
```

**Correct (`generate()` is the whole contract; uniqueness is opted into):**

```php
interface ShouldBeUnique
{
    public function isUnique(string $id): bool;
}
```

```php
abstract class TokenizedIdGenerator implements IdGenerator
{
    public function generate(): string
    {
        if (! $this instanceof ShouldBeUnique) {
            return $this->render();
        }

        for ($attempt = 0; $attempt < $this->maxGenerationAttempts(); $attempt++) {
            $id = $this->render();

            if ($this->isUnique($id)) {
                return $id;
            }
        }

        throw new UniqueIdGenerationException(static::class);
    }

    abstract protected function render(): string;

    protected function maxGenerationAttempts(): int
    {
        return 10;
    }
}
```

Bound the retry and throw a named exception — an exhausted budget means the format is too narrow, not that the caller should retry. The pre-check only narrows the collision window; the database unique constraint stays the guarantee under concurrency. See `rules/gate-earn-extension-seam.md` before publishing either contract.
