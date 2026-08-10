---
title: Keep Prefixes and Paths Consistent
impact: MEDIUM-HIGH
impactDescription: prevents /conversations/conversations/1 and its sibling bugs
tags: routing, prefixes, groups, naming
---

## Keep Prefixes and Paths Consistent

A group prefix plus a path that repeats it produces a double-nested URL. The route still registers, so nothing fails — the endpoint is simply at an address nobody expects, and the singular/plural inconsistency spreads to every generated link.

Convention: plural in the URI segment, singular in the parameter.

**Incorrect (prefix repeated, singular and plural mixed):**

```php
Route::prefix('conversations')->group(function (): void {
    Route::get('/conversations', ConversationIndexController::class);       // /conversations/conversations
    Route::get('/conversation/{conversation}', ConversationShowController::class); // /conversations/conversation/1
});
```

**Correct:**

```php
Route::prefix('conversations')->name('conversations.')->group(function (): void {
    Route::get('/', ConversationIndexController::class)->name('index');
    Route::post('/', ConversationStoreController::class)->name('store');

    Route::prefix('{conversation}')->scopeBindings()->group(function (): void {
        Route::get('/', ConversationShowController::class)->name('show');
        Route::get('/messages', MessageIndexController::class)->name('messages.index');
        Route::get('/messages/{message}', MessageShowController::class)->name('messages.show');
    });
});
```

Verify with `php artisan route:list --path=conversations` after any group change. The name prefix must end with a dot, or names concatenate into `conversationsindex`.
