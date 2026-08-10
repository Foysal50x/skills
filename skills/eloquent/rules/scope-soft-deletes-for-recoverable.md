---
title: Use SoftDeletes Only for Genuinely Recoverable Records
impact: MEDIUM
impactDescription: keeps unique constraints and queries honest
tags: soft-deletes, model, data-lifecycle
---

## Use SoftDeletes Only for Genuinely Recoverable Records

`SoftDeletes` is right when a record must be restorable or retained for audit. It is wrong as a default on every table: soft-deleted rows still occupy unique indexes, still join, and still have to be excluded from every raw query and reporting job.

For "hide it from the list but keep it", a domain column like `archived_at` is often clearer — it says what happened.

**Incorrect (soft deletes everywhere, and a unique index that now blocks re-registration):**

```php
final class User extends Model
{
    use SoftDeletes;
}

Schema::table('users', fn (Blueprint $t) => $t->unique('email'));
// Deleted user keeps the row → the same email can never sign up again.
```

**Correct (scope the uniqueness, or do not soft-delete):**

```php
final class User extends Model
{
    use SoftDeletes;
}

// Postgres: unique only among live rows
DB::statement('CREATE UNIQUE INDEX users_email_active ON users (email) WHERE deleted_at IS NULL');

// MySQL: include the discriminator in the index
$table->unique(['email', 'deleted_at']);
```

```php
// Or: no soft deletes, an explicit lifecycle column
$table->timestamp('archived_at')->nullable()->index();
```

Raw SQL, `DB::table()` queries and reporting views bypass the soft-delete scope entirely — audit those separately.
