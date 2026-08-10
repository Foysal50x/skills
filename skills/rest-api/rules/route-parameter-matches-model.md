---
title: Name the Route Parameter After the Bound Model
impact: MEDIUM-HIGH
impactDescription: binding and scoping both depend on the name
tags: routing, model-binding, naming
---

## Name the Route Parameter After the Bound Model

Implicit binding matches the route parameter name to the controller's type-hinted variable name, and scoped binding derives the parent relationship from the parameter name. A mismatch silently disables both — the controller receives the raw string, or an unscoped model.

Use the singular, camelCase model name: `{conversation}`, `{order}`, `{orderItem}`.

**Incorrect (three different names for one thing):**

```php
Route::get('/conversations/{id}/messages/{msg}', MessageShowController::class)->scopeBindings();

public function __invoke(Conversation $conversation, Message $message): MessageResource
// $conversation is not bound — the parameter is {id}.
// Scoping cannot find a `msg` relationship on Conversation.
```

**Correct:**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class)
    ->scopeBindings();

public function __invoke(Conversation $conversation, Message $message): MessageResource
```

```php
// Multi-word models use camelCase in the URI parameter:
Route::get('/orders/{order}/items/{orderItem}', OrderItemShowController::class)->scopeBindings();
```

If a URL segment must differ from the model name, bind explicitly rather than renaming the parameter: `Route::model('client', Customer::class)`.
