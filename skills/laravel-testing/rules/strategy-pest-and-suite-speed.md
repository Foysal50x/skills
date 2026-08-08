---
title: Keep the Suite Fast Enough to Run on Every Save
impact: MEDIUM-HIGH
impactDescription: a suite nobody runs prevents nothing
tags: strategy, speed, pest, ci
---

## Keep the Suite Fast Enough to Run on Every Save

A test suite is only useful at the frequency people run it. Two structural choices do most of the work: keep unit tests free of the database, and give the integration tests a fast database.

Use `RefreshDatabase` (transaction rollback) rather than `DatabaseMigrations` (re-migrate per test). Run tests in parallel. Fake external services rather than hitting them.

**Incorrect (every test migrates from scratch and boots the full application):**

```php
uses(DatabaseMigrations::class);   // re-runs every migration, per test

it('formats a date range label', function (): void {
    expect((new DateRange(now()->subDay(), now()))->isBounded())->toBeTrue();
});
// A pure predicate paying a full migration.
```

**Correct:**

```php
// tests/Pest.php
uses(Tests\TestCase::class, RefreshDatabase::class)->in('Feature', 'Integration');
uses(Tests\TestCase::class)->in('Unit');           // no database at all
```

```xml
<!-- phpunit.xml -->
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
<env name="MAIL_MAILER" value="array"/>
```

```bash
php artisan test --parallel
php artisan test --dirty          # only what changed, during development
```

One caveat on SQLite: it does not behave identically to MySQL or Postgres for JSON operators, full-text search, locking or strict-mode errors. Run the integration suite against the production engine in CI even if local runs use SQLite.
