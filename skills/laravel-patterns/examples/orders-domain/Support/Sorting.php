<?php

declare(strict_types=1);

namespace App\Support\Filters;

/**
 * PURE value object. It parses its own wire format in a named constructor, so the
 * controller, the console command and the job payload all produce the same object
 * with the same defaults. It never touches a Builder.
 */
final readonly class Sorting
{
    public function __construct(
        public string $column,
        public Direction $direction = Direction::Asc,
    ) {}

    /** Accepts the API sort syntax: "created_at" ascending, "-created_at" descending. */
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

    public static function latest(string $column = 'created_at'): self
    {
        return new self($column, Direction::Desc);
    }

    public static function oldest(string $column = 'created_at'): self
    {
        return new self($column, Direction::Asc);
    }

    public function isAscending(): bool
    {
        return $this->direction === Direction::Asc;
    }

    /** The round trip back, for pagination links and cache keys. */
    public function toString(): string
    {
        return ($this->direction === Direction::Desc ? '-' : '').$this->column;
    }
}
