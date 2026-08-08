<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Orders\Contracts\OrderRepositoryInterface;
use App\Domain\Orders\Enums\OrderStatus;
use App\Domain\Orders\Filters\OrderQueryFilter;
use App\Support\Filters\Date\DateRange;
use App\Support\Filters\Direction;
use App\Support\Filters\Sorting;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Maps Request → Value Objects. Nothing inward ever sees HTTP.
 */
final class OrderIndexController
{
    public function __invoke(Request $request, OrderRepositoryInterface $orders): View
    {
        $dateRange = ($request->filled('from') || $request->filled('to'))
            ? new DateRange(
                $request->date('from')?->toImmutable(),
                $request->date('to')?->toImmutable(),
            )
            : null;

        $sorting = $request->filled('sort')
            ? new Sorting(
                $request->string('sort')->toString(),
                Direction::tryFrom($request->string('dir', 'desc')->toString()) ?? Direction::Desc,
            )
            : null;

        $filter = new OrderQueryFilter(
            merchantId: $request->integer('merchant_id') ?: null,
            status: $request->enum('status', OrderStatus::class),
            dateRange: $dateRange,
            search: $request->string('search')->trim()->toString() ?: null,
            sorting: $sorting,
        );

        return view('admin.orders.index', [
            'orders' => $orders->searchOrders($filter, perPage: 25),
        ]);
    }
}
