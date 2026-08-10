<?php

declare(strict_types=1);

namespace App\Domain\Orders\Queries;

use App\Domain\Orders\Filters\OrderQueryFilter;
use App\Domain\Orders\Models\Order;
use App\Support\Filters\Date\DateRange;
use Illuminate\Database\Eloquent\Builder;

/**
 * INTERNAL to App\Domain\Orders\Repositories. One public method: handle().
 *
 * Returns a Builder because callers need different result types
 * (paginate for the admin list, count for the badge, lazy for the export).
 */
final readonly class SearchOrdersQuery
{
    private const SORTABLE = ['created_at', 'number', 'total'];

    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()
            ->with(['customer', 'merchant'])
            ->when(
                $filter->merchantId !== null,
                fn (Builder $q) => $q->where('merchant_id', $filter->merchantId),
            )
            ->when(
                $filter->status !== null,
                fn (Builder $q) => $q->where('status', $filter->status),
            )
            ->when(
                $filter->dateRange !== null,
                fn (Builder $q) => $this->applyDateRange($q, $filter->dateRange, 'created_at'),
            )
            ->when(
                $filter->search !== null,
                fn (Builder $q) => $this->applySearch($q, $filter->search),
            )
            ->when(
                $filter->sorting !== null && in_array($filter->sorting->column, self::SORTABLE, true),
                fn (Builder $q) => $q->orderBy($filter->sorting->column, $filter->sorting->direction->value),
                fn (Builder $q) => $q->latest(),
            );
    }

    /** Query code stays inside the query class — never on the value object. */
    private function applyDateRange(Builder $query, DateRange $range, string $column): void
    {
        $query->where(function (Builder $query) use ($range, $column): void {
            if ($range->from !== null) {
                $query->where($column, '>=', $range->from);
            }

            if ($range->to !== null) {
                $query->where($column, '<=', $range->to);
            }
        });
    }

    private function applySearch(Builder $query, string $search): void
    {
        $query->where(function (Builder $query) use ($search): void {
            $query->where('number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $q) => $q->where('email', 'like', "%{$search}%"));
        });
    }
}
