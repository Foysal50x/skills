<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Orders\Contracts\OrderRepositoryInterface;
use App\Http\Requests\SearchOrdersRequest;
use Illuminate\View\View;

/**
 * Maps HTTP and delegates. The Form Request authorized the caller, validated the
 * input and produced the filter; nothing inward ever sees a Request, and no
 * query clause is written here.
 */
final class OrderIndexController
{
    public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): View
    {
        return view('admin.orders.index', [
            'orders' => $orders->searchOrders($request->toFilter(), perPage: 25),
        ]);
    }
}
