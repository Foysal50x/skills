<?php

declare(strict_types=1);

namespace App\Support\Filters\Date;

use Carbon\CarbonImmutable;

/**
 * PURE value object: data plus pure predicates and transformations.
 * It must never import Builder or call where()/orderBy().
 */
final readonly class DateRange
{
    public function __construct(
        public ?CarbonImmutable $from = null,
        public ?CarbonImmutable $to = null,
    ) {}

    public function isBounded(): bool
    {
        return $this->from !== null || $this->to !== null;
    }

    public function covers(CarbonImmutable $date): bool
    {
        return ($this->from === null || $date->greaterThanOrEqualTo($this->from))
            && ($this->to === null || $date->lessThanOrEqualTo($this->to));
    }

    public function intersect(self $other): self
    {
        $from = ($this->from === null || $other->from === null)
            ? $this->from ?? $other->from
            : max($this->from, $other->from);

        $to = ($this->to === null || $other->to === null)
            ? $this->to ?? $other->to
            : min($this->to, $other->to);

        return new self($from, $to);
    }
}
