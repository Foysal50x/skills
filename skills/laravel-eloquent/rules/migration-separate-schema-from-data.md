---
title: Keep Schema Changes and Data Changes in Separate Migrations
impact: MEDIUM-HIGH
impactDescription: a failed backfill no longer blocks the schema change
tags: migrations, data, deployment, safety
---

## Keep Schema Changes and Data Changes in Separate Migrations

A migration that creates a table and then fills it has two ways to fail and one row in the `migrations` table. If the insert throws, the DDL has already committed on MySQL — which does not roll back schema changes — so the migration is recorded as failed, cannot be re-run, and the table exists half-configured.

Split them: one migration for structure, one for data. Better still, put the backfill in a queued job or a console command so it can be re-run, chunked and monitored.

**Incorrect (one file, two responsibilities, no safe retry):**

```php
public function up(): void
{
    Schema::create('plans', function (Blueprint $table): void {
        $table->id();
        $table->string('code')->unique();
        $table->unsignedInteger('price_cents');
    });

    DB::table('plans')->insert([
        ['code' => 'free', 'price_cents' => 0],
        ['code' => 'pro', 'price_cents' => 4900],
    ]);
}
```

**Correct:**

```php
// 2026_03_02_090000_create_plans_table.php — structure only
Schema::create('plans', function (Blueprint $table): void { /* ... */ });

// 2026_03_02_090100_seed_default_plans.php — data only, and idempotent
public function up(): void
{
    DB::table('plans')->upsert([
        ['code' => 'free', 'price_cents' => 0],
        ['code' => 'pro', 'price_cents' => 4900],
    ], uniqueBy: ['code'], update: ['price_cents']);
}
```

A backfill over a large table belongs in a chunked command, not a migration — see `rules/perf-chunk-large-result-sets.md`.
