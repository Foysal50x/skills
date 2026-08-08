---
title: Scope Nested Bindings to Their Parent
impact: CRITICAL
impactDescription: turns a nested URL into an enforced relationship
tags: routing, model-binding, security, nesting
---

## Scope Nested Bindings to Their Parent

`/conversations/{conversation}/messages/{message}` resolves both models independently by default. Nothing checks that the message belongs to the conversation — so any valid message ID works under any conversation URL.

Scoped binding resolves the child *through* the parent's relationship, making the hierarchy an enforced constraint.

**Incorrect (independent lookups; the URL lies):**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class);

// GET /conversations/1/messages/999 returns message 999 from conversation 42.
```

**Correct (explicit scoping):**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class)
    ->scopeBindings();

// Or for a whole group:
Route::scopeBindings()->group(function (): void {
    Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class);
    Route::patch('/conversations/{conversation}/messages/{message}', MessageUpdateController::class);
});
```

Scoping is automatic when the child is bound by a custom key (`{message:uuid}`), and off otherwise — so state it explicitly rather than relying on which form you happened to write.

The child model must expose the relationship Laravel infers from the parameter name: `{message}` under `{conversation}` resolves via `Conversation::messages()`.
