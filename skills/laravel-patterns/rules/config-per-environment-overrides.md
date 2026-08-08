---
title: Override Configuration per Environment, Not per Branch
impact: MEDIUM
impactDescription: one code path across local, CI, staging and production
tags: config, environments, testing
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
