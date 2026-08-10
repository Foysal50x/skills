---
title: Parse the Wire Format in a Named Constructor
impact: MEDIUM-HIGH
impactDescription: one parser instead of one per entry point
tags: value-object, named-constructor, parsing, sorting
---

## Parse the Wire Format in a Named Constructor

A Value Object that travels over HTTP has a string form — `-created_at`, `2026-01..2026-03`, `EUR 12.50`. Parse it inside the Value Object with a named constructor, so the HTTP controller, the console command and the job payload all produce the same object with the same defaults.

Parsed at the call site instead, the rule drifts: the list endpoint treats a missing `-` as ascending, the export endpoint forgets and sorts the other way, and nobody notices until a customer does.

**Incorrect (the same three lines, slightly different, in every entry point):**

```php
$sort = $request->string('sort', 'created_at')->toString();
$direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

$sorting = new Sorting(ltrim($sort, '-'), $direction);
```

**Correct:**

```php
namespace App\Support\Filters;

final readonly class Sorting
{
    public function __construct(
        public string $column,
        public Direction $direction = Direction::Asc,
    ) {}

    /**
     * Accepts the API sort syntax: "created_at" ascending, "-created_at" descending.
     */
    public static function fromString(string $expression): self
    {
        $expression = trim($expression);

        return new self(
            column: ltrim($expression, '-+'),
            direction: str_starts_with($expression, '-') ? Direction::Desc : Direction::Asc,
        );
    }

    /** Null-safe for an optional query parameter. */
    public static function tryFromString(?string $expression, ?self $default = null): ?self
    {
        return blank($expression) ? $default : self::fromString($expression);
    }

    public function toString(): string
    {
        return ($this->direction === Direction::Desc ? '-' : '').$this->column;
    }
}
```

```php
// Form Request
public function toFilter(): OrderQueryFilter
{
    return new OrderQueryFilter(
        sorting: Sorting::tryFromString($this->input('sort'), new Sorting('created_at', Direction::Desc)),
    );
}
```

`toString()` gives the round trip back for pagination links and cache keys. The Value Object stays pure — it never checks the column against a table. That check belongs to `rules/query-whitelist-sortable-columns.md`.
