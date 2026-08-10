---
title: Declare Foreign Keys With constrained() and a Delete Behaviour
impact: MEDIUM-HIGH
impactDescription: the database refuses orphan rows instead of the application discovering them
tags: migrations, foreign-keys, integrity, indexing
---

## Declare Foreign Keys With constrained() and a Delete Behaviour

A plain `unsignedBigInteger('user_id')` is a number with a naming convention attached. Nothing stops a delete from leaving rows pointing at a user that no longer exists, and the bug surfaces months later as a null relation in a report.

`foreignId()->constrained()` names the constraint, adds the index and enforces the reference. Always state what a parent delete does — the default is to refuse it, and silence about that is a decision nobody made on purpose.

**Incorrect (an integer column that documents an intention):**

```php
Schema::create('invoices', function (Blueprint $table): void {
    $table->id();
    $table->unsignedBigInteger('customer_id');
    $table->unsignedBigInteger('approved_by')->nullable();
    $table->timestamps();
});
```

**Correct:**

```php
Schema::create('invoices', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
    $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

`constrained('users')` covers the non-conventional column name. The behaviours are `cascadeOnDelete()`, `nullOnDelete()`, `restrictOnDelete()` and `noActionOnDelete()` — pick per relationship, not per project.

Cascading deletes at the database level skip model events, so an observer that cleans up files or search indexes will not run. Where that matters, use `restrictOnDelete()` and delete through the domain.
