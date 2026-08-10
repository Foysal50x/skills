<?php

declare(strict_types=1);

namespace App\Support\Filters;

enum Direction: string
{
    case Asc = 'asc';
    case Desc = 'desc';
}

final readonly class Sorting
{
    public function __construct(
        public string $column,
        public Direction $direction = Direction::Desc,
    ) {}

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
}
