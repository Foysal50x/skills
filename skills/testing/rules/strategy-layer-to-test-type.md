---
title: Match the Test Style to the Layer
impact: HIGH
impactDescription: fast suites that fail for the right reason
tags: strategy, layers, architecture, testing
---

## Match the Test Style to the Layer

Each layer has one style that fits it. Using the wrong one gives you a slow suite that breaks on refactors and misses real bugs.

| Layer | Style | Database | What it proves |
|-------|-------|----------|----------------|
| **Action** | Unit, with a fake repository | No | The use case orchestrates correctly |
| **Service** | Unit, with fakes | No | The business decision is right |
| **Repository** | Integration, real DB + factories | Yes | Methods return the right domain types |
| **Query Class** | Integration, real DB + factories | Yes | Which rows are in, which are out, in what order |
| **Value Object** | Pure unit | No | Predicates and transformations |
| **Controller / route** | Feature test | Usually | Status, payload shape, authorization |
| **Job / Listener** | Unit for the handler, fake for dispatch | Depends | Idempotency and effects |

**Incorrect (an Action test that boots a database to prove orchestration):**

```php
uses(RefreshDatabase::class);

it('submits a prompt', function (): void {
    $conversation = Conversation::factory()->hasMessages(20)->create();

    $message = app(SubmitPromptAction::class)->handle(new SubmitPromptData($conversation->id, 'hi'));

    expect($message->content)->not->toBeEmpty();
});
// Slow, and it fails when the query changes rather than when the orchestration does.
```

**Correct (fake the boundary, no database):**

```php
it('builds context from recent and relevant messages', function (): void {
    $chat = new class implements ChatRepositoryInterface {
        public function recentMessages(Conversation $c, int $limit = 20): Collection
        {
            return collect([new Message(['content' => 'recent'])]);
        }

        public function relevantMessages(Conversation $c, string $prompt, int $limit = 10): Collection
        {
            return collect([new Message(['content' => 'relevant context'])]);
        }
    };

    $context = (new ConversationContextService($chat))->buildContextFor(new Conversation(), 'a question');

    expect($context)->toContain('relevant context');
});
```
