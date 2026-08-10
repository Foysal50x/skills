---
title: Never Edit a Migration That Has Run in Production
impact: HIGH
impactDescription: keeps every environment's schema identical
tags: migrations, deployment, schema, safety
---

## Never Edit a Migration That Has Run in Production

Once a migration is in the `migrations` table of any environment you do not control, it is history. Editing it changes what a fresh database gets and leaves every existing database untouched — production and a new developer's machine now have different schemas, and nothing reports it.

Add a new migration instead. It is one file, and it is the only version that runs everywhere.

**Incorrect (the column exists on new installs only):**

```php
// database/migrations/2026_01_11_000000_create_invoices_table.php — already deployed
Schema::create('invoices', function (Blueprint $table): void {
    $table->id();
    $table->string('number');
    $table->string('external_ref')->nullable();   // ← added weeks later
    $table->timestamps();
});
```

**Correct:**

```php
// database/migrations/2026_03_02_090000_add_external_ref_to_invoices_table.php
public function up(): void
{
    Schema::table('invoices', function (Blueprint $table): void {
        $table->string('external_ref')->nullable()->after('number');
    });
}

public function down(): void
{
    Schema::table('invoices', function (Blueprint $table): void {
        $table->dropColumn('external_ref');
    });
}
```

The exception is a migration that has only ever run on your own machine and is not yet merged. After merge, treat it as deployed. Squashing with `schema:dump` is the supported way to collapse old migrations — editing them is not.
