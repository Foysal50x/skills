<?php

declare(strict_types=1);

namespace App\Domain\Orders\Actions;

use App\Domain\Orders\Contracts\OrderRepositoryInterface;
use App\Domain\Orders\Events\OrderPlaced;
use App\Domain\Orders\Models\Order;
use App\Domain\Orders\Services\ShippingRateService;
use Illuminate\Support\Facades\DB;

/**
 * One use case, end to end. Domain in, domain out — callable from the
 * controller, the CSV import command or a test without change.
 */
final readonly class PlaceOrderAction
{
    public function __construct(
        private OrderRepositoryInterface $orders,
        private ShippingRateService $shipping,
    ) {}

    public function handle(CreateOrderData $data): Order
    {
        $order = DB::transaction(fn (): Order => $this->orders->place(
            $data,
            $this->shipping->rateFor($data->destination, $this->weight($data)),
        ));

        // Dispatched after commit so listeners never read uncommitted state.
        OrderPlaced::dispatch($order->tenantId(), $order->id());

        return $order;
    }

    /** Single-use logic stays here as a private method. */
    private function weight(CreateOrderData $data): int
    {
        return array_sum(array_column($data->items, 'weight_grams'));
    }
}
