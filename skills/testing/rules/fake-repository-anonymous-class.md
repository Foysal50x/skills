---
title: Fake a Repository With an Anonymous Class
impact: HIGH
impactDescription: unit-test Actions and Services without a database
tags: fakes, repository, unit-test, doubles
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
