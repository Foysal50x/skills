<?php

declare(strict_types=1);

namespace App\Domain\Orders\Filters;

use App\Domain\Orders\Enums\OrderStatus;
use App\Support\Filters\Date\DateRange;
use App\Support\Filters\Sorting;

/**
 * Composite filter DTO: collapses SearchOrdersQuery::handle() to one parameter.
 * Adding a filter touches this class and the query class, not every caller.
 */
final readonly class OrderQueryFilter
{
    public function __construct(
        public ?int $merchantId = null,
        public ?OrderStatus $status = null,
        public ?DateRange $dateRange = null,
        public ?string $search = null,
        public ?Sorting $sorting = null,
    ) {}
}
