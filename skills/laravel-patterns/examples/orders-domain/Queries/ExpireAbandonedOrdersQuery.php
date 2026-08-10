<?php

declare(strict_types=1);

namespace App\Domain\Orders\Queries;

use App\Domain\Orders\Enums\OrderStatus;
use App\Domain\Orders\Models\Order;
use Carbon\CarbonImmutable;

/**
 * A write whose main value is the database operation itself.
 * Note: a bulk update bypasses model events — the caller dispatches
 * OrdersExpired itself if listeners must run.
 */
final readonly class ExpireAbandonedOrdersQuery
{
    public function handle(CarbonImmutable $expiredBefore): int
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->where('created_at', '<=', $expiredBefore)
            ->update([
                'status' => OrderStatus::Expired,
                'expired_at' => now(),
            ]);
    }
}
