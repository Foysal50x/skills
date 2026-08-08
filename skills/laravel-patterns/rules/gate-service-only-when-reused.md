---
title: Extract a Service Only When Two Actions Need It
impact: HIGH
impactDescription: prevents premature indirection
tags: gate, service, reuse
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
