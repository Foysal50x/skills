---
title: Use Eloquent Directly by Default
impact: CRITICAL
impactDescription: removes the largest source of dead abstraction
tags: gate, eloquent, repository, simplicity
---

## Use Eloquent Directly by Default

Q4 of the Decision Gate, and the default answer whenever Q4 and Q5 feel ambiguous. Eloquent is already a good abstraction. Simple CRUD, a single `where()->get()` used in one place, `Model::find()`, `$model->update()` — these need no Repository, no Query Class and no interface.

A Repository over Eloquent does not fully decouple you from Eloquent anyway: relationships, accessors and scopes remain. That is acceptable and expected. Do not chase purity.

**Incorrect (a layer that only forwards):**

```php
interface ConversationRepositoryInterface
{
    public function find(int $id): ?Conversation;
    public function create(array $attributes): Conversation;
}

final class EloquentConversationRepository implements ConversationRepositoryInterface
{
    public function find(int $id): ?Conversation
    {
        return Conversation::find($id);
    }

    public function create(array $attributes): Conversation
    {
        return Conversation::create($attributes);
    }
}
```

**Correct (call Eloquent, delete the layer):**

```php
final readonly class ArchiveConversationAction
{
    public function handle(Conversation $conversation): void
    {
        $conversation->update(['archived_at' => now()]);
    }
}
```

"Maybe someday we will switch databases" is not a valid trigger. See `rules/gate-repository-earns-its-name.md` for what is.
