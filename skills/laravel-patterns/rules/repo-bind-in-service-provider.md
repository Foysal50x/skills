---
title: Bind the Interface in a Service Provider
impact: MEDIUM
impactDescription: the backend swap must be one line
tags: repository, container, binding, provider
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
