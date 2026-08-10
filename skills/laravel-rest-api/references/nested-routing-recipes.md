# Nested Routing Recipes

## The trap these avoid

`/conversations/{conversation}/messages/{message}` resolves both models independently unless you scope the binding. Without `scopeBindings()`, message 999 from conversation 42 loads happily under conversation 1.

## Recipe 1 — nested collection, shallow member

Nest where the parent identifies the collection; go shallow once the child is uniquely identified.

```php
Route::prefix('conversations')->name('conversations.')->group(function (): void {
    Route::get('/', ConversationIndexController::class)->name('index');
    Route::post('/', ConversationStoreController::class)->name('store');

    Route::prefix('{conversation}')->scopeBindings()->group(function (): void {
        Route::get('/', ConversationShowController::class)->name('show');
        Route::get('/messages', MessageIndexController::class)->name('messages.index');
        Route::post('/messages', MessageStoreController::class)->name('messages.store');
    });
});

// Shallow — the message id is unique; the Policy enforces ownership.
Route::get('/messages/{message}', MessageShowController::class)->name('messages.show');
Route::delete('/messages/{message}', MessageDestroyController::class)->name('messages.destroy');
```

## Recipe 2 — fully nested with scoping

When the child key is only unique within the parent (a per-order line number, a per-project slug):

```php
Route::scopeBindings()->group(function (): void {
    Route::get('/orders/{order}/items/{orderItem}', OrderItemShowController::class);
    Route::patch('/orders/{order}/items/{orderItem}', OrderItemUpdateController::class);
});
```

The child model must expose the relationship inferred from the parameter name — `{orderItem}` under `{order}` resolves via `Order::orderItems()`.

## Recipe 3 — custom keys

Binding by a non-key column enables scoping automatically, but declare it anyway so the behavior does not depend on which form was written:

```php
Route::get('/projects/{project:slug}/tasks/{task:uuid}', TaskShowController::class)
    ->scopeBindings();
```

## Recipe 4 — tenant prefix

Put the tenant in middleware and a global scope rather than in every route parameter:

```php
Route::middleware(['auth', ResolveTenant::class])->group(function (): void {
    Route::get('/orders/{order}', OrderShowController::class);   // 404s cross-tenant
});
```

The global scope on `Order` makes an out-of-tenant id unresolvable, so binding returns 404 without any per-route work.

## Checks after any route change

```bash
php artisan route:list --path=conversations
php artisan route:cache && php artisan route:clear
```

Name prefixes must end with a dot (`->name('conversations.')`), or names concatenate into `conversationsindex`.
