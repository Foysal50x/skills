---
title: Pass Essential Domain Objects Directly
impact: MEDIUM
impactDescription: keeps the subject of a query visible in the signature
tags: value-object, dto, api-design
---

## Pass Essential Domain Objects Directly

An essential domain object — the thing the operation is *about* — is passed as its own parameter, not buried inside a filter DTO. Burying it hides the subject of the call and makes the DTO mean two different things.

**Incorrect (the conversation, which is mandatory, hidden among optional filters):**

```php
final readonly class MessageQueryFilter
{
    public function __construct(
        public Conversation $conversation,   // not a filter — it is the subject
        public ?int $limit = null,
        public ?DateRange $dateRange = null,
    ) {}
}

$chat->recentMessages(new MessageQueryFilter($conversation, limit: 20));
```

**Correct (subject first, filters grouped):**

```php
public function recentMessages(Conversation $conversation, int $limit = 20): Collection;

public function searchMessages(Conversation $conversation, MessageQueryFilter $filter): Collection;
```

The signature now says what the query is about and what narrows it.
