---
title: Mirror Column Defaults in the Model
impact: MEDIUM
impactDescription: an unsaved model behaves like a saved one
tags: migrations, models, defaults, consistency
---

## Mirror Column Defaults in the Model

A database default only applies at `INSERT`. Until the row is written, `new Invoice()->status` is `null`, so validation, policies and any calculation that runs before the save see a value the database would never store. The bug appears as a `null` enum cast or a policy that lets an unsaved draft through.

Declare the same default in `$attributes` on the model.

**Incorrect (the default exists in one of the two places it is read from):**

```php
// Migration
$table->string('status')->default('draft');
$table->unsignedInteger('retry_count')->default(0);

// Model — nothing
$invoice = new Invoice(['number' => $number]);
$invoice->status;        // null
$invoice->retry_count;   // null
```

**Correct:**

```php
final class Invoice extends Model
{
    protected $attributes = [
        'status' => InvoiceStatus::Draft->value,
        'retry_count' => 0,
    ];

    protected function casts(): array
    {
        return ['status' => InvoiceStatus::class];
    }
}
```

`$attributes` holds raw database values, so use the enum's `->value` rather than the case — the cast converts it on read. Keep both sides in step: a migration that changes a default gets a matching model change in the same commit, or the two drift apart silently.
