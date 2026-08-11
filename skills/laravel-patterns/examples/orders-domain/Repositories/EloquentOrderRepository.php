<?php

declare(strict_types=1);

namespace App\Domain\Orders\Repositories;

use App\Domain\Orders\Contracts\OrderRepositoryInterface;
use App\Domain\Orders\Enums\OrderStatus;
use App\Domain\Orders\Filters\OrderQueryFilter;
use App\Domain\Orders\Models\Order;
use App\Domain\Orders\Queries\ExpireAbandonedOrdersQuery;
use App\Domain\Orders\Queries\SearchOrdersQuery;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The only place that may import App\Domain\Orders\Queries.
 * Complex queries are delegated; trivial ones are inlined.
 */
final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function __construct(
        private SearchOrdersQuery $searchOrders,
        private ExpireAbandonedOrdersQuery $expireAbandoned,
    ) {}

    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }

    public function countMatching(OrderQueryFilter $filter): int
    {
        return $this->searchOrders->handle($filter)->count();
    }

    /**
     * Inlined: one condition, no rules worth naming. Bounded on purpose — this
     * feeds the ops queue, not a list endpoint, so it may return a Collection.
     */
    public function pendingOrders(?int $merchantId = null): Collection
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->when($merchantId !== null, fn (Builder $q) => $q->where('merchant_id', $merchantId))
            ->limit(200)
            ->get();
    }

    public function expireAbandoned(CarbonImmutable $expiredBefore): int
    {
        return $this->expireAbandoned->handle($expiredBefore);
    }
}
