---
title: Write a down() That Actually Reverses up()
impact: MEDIUM
impactDescription: a failed deploy can roll back instead of being repaired by hand
tags: migrations, rollback, deployment
---

## Write a down() That Actually Reverses up()

`migrate:rollback` runs in two places that matter: a deploy that failed halfway, and a local branch switch. An empty `down()` turns both into manual schema surgery.

Reverse exactly what `up()` did, in the opposite order. When a change genuinely cannot be reversed — a dropped column whose data is gone, a destructive backfill — say so in the method rather than leaving it blank, and ship the fix forward as a new migration.

**Incorrect (generated stub left as-is):**

```php
public function up(): void
{
    Schema::table('invoices', function (Blueprint $table): void {
        $table->string('external_ref')->nullable();
        $table->index(['status', 'issued_at']);
    });
}

public function down(): void
{
    //
}
```

**Correct:**

```php
public function down(): void
{
    Schema::table('invoices', function (Blueprint $table): void {
        $table->dropIndex(['status', 'issued_at']);
        $table->dropColumn('external_ref');
    });
}
```

```php
public function down(): void
{
    throw new RuntimeException(
        'Irreversible: the pre-merge customer_name values were dropped. Roll forward instead.',
    );
}
```

Test it the cheap way: run `php artisan migrate` then `php artisan migrate:rollback` on a scratch database before opening the pull request.
