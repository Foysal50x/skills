---
title: Query Classes and Repositories Arrive Together
impact: HIGH
impactDescription: prevents a second, competing data-access path
tags: gate, query-class, repository, boundary
---

## Query Classes and Repositories Arrive Together

Query Classes and Repositories are not competing patterns. A Query Class is the *internal implementation technique* of a Repository: the Repository interface is the swappable public contract, and Query Classes are the named, focused, testable Eloquent queries it delegates to.

The trigger is the same for both — the query earns a name. So:

- Never create a Query Class without a Repository around it.
- Never create a Repository whose methods never delegate to one (if every method is a trivial inline, the Repository failed Q5).

**Incorrect (Query Class with no Repository — a second public data path):**

```php
final readonly class SubmitPromptAction
{
    public function __construct(private RecentMessagesQuery $recentMessages) {}

    public function handle(SubmitPromptData $data): Message
    {
        $history = $this->recentMessages->handle($data->conversation, 20);
        // ...
    }
}
```

**Correct (Action depends on the contract; the Repository owns the Query Class):**

```php
final readonly class SubmitPromptAction
{
    public function __construct(private ChatRepositoryInterface $chat) {}

    public function handle(SubmitPromptData $data): Message
    {
        $history = $this->chat->recentMessages($data->conversation, 20);
        // ...
    }
}

final readonly class EloquentChatRepository implements ChatRepositoryInterface
{
    public function __construct(private RecentMessagesQuery $recentMessages) {}

    public function recentMessages(Conversation $conversation, int $limit = 20): Collection
    {
        return $this->recentMessages->handle($conversation, $limit)->get();
    }
}
```

See `rules/query-internal-to-repositories.md` for the enforcement boundary.
