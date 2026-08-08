---
title: Never Call env() Outside config
impact: HIGH
impactDescription: config:cache makes every other env() call return null
tags: config, env, production, caching
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
