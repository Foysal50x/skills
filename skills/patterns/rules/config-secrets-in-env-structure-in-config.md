---
title: Secrets in .env, Structure in config
impact: MEDIUM
impactDescription: keeps deploys reproducible and secrets out of git
tags: config, env, secrets
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

A secret read from config still leaks the moment it becomes a function argument: PHP writes every argument into stack traces. Mark those parameters `#[\SensitiveParameter]` — see the `laravel-skill:rest-api` skill's `error-sensitive-parameter-attribute` rule — and never pass one into a queued job's constructor.
