<?php

declare(strict_types=1);

namespace App\Domain\Orders\Contracts;

use App\Domain\Orders\Filters\OrderQueryFilter;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Trigger (Decision Gate Q5b): order search drives the admin list, the CSV
 * export and the merchant dashboard. One change point for the filter rules.
 *
 * Domain-intent methods. Domain return types. Never Builder, never Request.
 */
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;

    public function countMatching(OrderQueryFilter $filter): int;

    public function pendingOrders(?int $merchantId = null): Collection;

    public function expireAbandoned(CarbonImmutable $expiredBefore): int;
}
