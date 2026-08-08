---
title: Nest Only as Deep as the Parent Is Needed
impact: MEDIUM
impactDescription: keeps URLs and route files readable
tags: routing, nesting, rest, api-design
---

## Nest Only as Deep as the Parent Is Needed

Nest routes where the parent is required to identify or authorize the child: index and store. Once the child has its own unique identifier, the parent adds nothing — show, update and destroy can be shallow.

Two levels is the practical limit. `/merchants/{merchant}/orders/{order}/items/{item}/refunds/{refund}` serves nobody.

**Incorrect (nested all the way, so every link needs three IDs):**

```php
Route::get('/merchants/{merchant}/orders/{order}/items/{item}', ItemShowController::class);
Route::patch('/merchants/{merchant}/orders/{order}/items/{item}', ItemUpdateController::class);
Route::delete('/merchants/{merchant}/orders/{order}/items/{item}', ItemDestroyController::class);
```

**Correct (nested where the parent is needed, shallow after that):**

```php
// Parent required — it scopes the collection:
Route::get('/orders/{order}/items', ItemIndexController::class)->scopeBindings();
Route::post('/orders/{order}/items', ItemStoreController::class)->scopeBindings();

// Child is uniquely identified — authorize via policy instead:
Route::get('/items/{item}', ItemShowController::class);
Route::patch('/items/{item}', ItemUpdateController::class);
Route::delete('/items/{item}', ItemDestroyController::class);
```

Shallow routes shift the ownership check from the URL to the Policy, so the Policy must actually check it — see `rules/authz-policies-per-model.md`.
