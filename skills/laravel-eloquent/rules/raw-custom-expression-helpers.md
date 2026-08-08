---
title: Wrap Driver-Specific SQL in an Expression Class
impact: MEDIUM
impactDescription: one place owns each cross-database difference
tags: expressions, portability, sqlite, testing
---

## Wrap Driver-Specific SQL in an Expression Class

Date formatting, JSON extraction and string functions differ per driver. If tests run on SQLite and production on MySQL, inline `date_format()` passes CI and fails in production — or vice versa.

Implement `Illuminate\Contracts\Database\Query\Expression` once. Shared helpers live in `app/Support/Query/`, domain-specific ones in `Domain/<Context>/Support/Query/`. They are query construction, so they are used only inside Query Classes and Repositories.

**Incorrect (MySQL syntax, SQLite test suite):**

```php
Order::selectRaw("date_format(created_at, '%Y-%m') as month")->groupBy('month')->get();
```

**Correct:**

```php
namespace App\Support\Query;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Database\Grammar;
use Illuminate\Database\Query\Grammars\{PostgresGrammar, SQLiteGrammar, SqlServerGrammar};

final class DateFmt implements Expression
{
    public function __construct(
        private readonly string|Expression $column,
        private readonly string $format = 'Y-m',
    ) {}

    public function getValue(Grammar $grammar): string
    {
        $column = $grammar->wrap($this->column);

        return match (true) {
            $grammar instanceof SQLiteGrammar => "strftime('{$this->token('sqlite')}', {$column})",
            $grammar instanceof PostgresGrammar => "to_char({$column}, '{$this->token('pgsql')}')",
            $grammar instanceof SqlServerGrammar => "format({$column}, '{$this->token('sqlsrv')}')",
            default => "date_format({$column}, '{$this->token('mysql')}')",
        };
    }

    private function token(string $driver): string
    {
        return match ($driver) {
            'sqlite', 'mysql' => ['Y-m' => '%Y-%m', 'Y-m-d' => '%Y-%m-%d', 'Y' => '%Y'][$this->format] ?? '%Y-%m-%d',
            'pgsql' => ['Y-m' => 'YYYY-MM', 'Y-m-d' => 'YYYY-MM-DD', 'Y' => 'YYYY'][$this->format] ?? 'YYYY-MM-DD',
            'sqlsrv' => ['Y-m' => 'yyyy-MM', 'Y-m-d' => 'yyyy-MM-dd', 'Y' => 'yyyy'][$this->format] ?? 'yyyy-MM-dd',
        };
    }
}
```

```php
->select(new Alias(new DateFmt('created_at', 'Y-m'), 'month'))
->groupBy(new DateFmt('created_at', 'Y-m'))
```

The better fix, where possible, is to test against the same engine you run in production.
