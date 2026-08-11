<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Domain\Orders\Enums\OrderStatus;
use App\Domain\Orders\Filters\OrderQueryFilter;
use App\Domain\Orders\Models\Order;
use App\Support\Filters\Date\DateRange;
use App\Support\Filters\Sorting;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The read-side boundary. Authorization, validation and the mapping to Value
 * Objects all live here, so the controller stays one line and the same filter
 * can be built by the nightly export command from its own arguments.
 */
final class SearchOrdersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Order::class) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', 'max:40'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $search = $this->input('search');

        // Normalize only what is already a string; anything else passes through
        // unchanged so `rules()` returns a validation error rather than this
        // method casting an array and corrupting the input.
        if (is_string($search)) {
            $this->merge(['search' => trim($search) ?: null]);
        }
    }

    public function toFilter(): OrderQueryFilter
    {
        return new OrderQueryFilter(
            merchantId: $this->integer('merchant_id') ?: null,
            status: $this->enum('status', OrderStatus::class),
            dateRange: $this->dateRange(),
            search: $this->validated('search'),
            sorting: Sorting::tryFromString($this->validated('sort'), Sorting::latest()),
        );
    }

    private function dateRange(): ?DateRange
    {
        if (! $this->filled('from') && ! $this->filled('to')) {
            return null;
        }

        return new DateRange(
            $this->date('from')?->toImmutable(),
            $this->date('to')?->toImmutable(),
        );
    }
}
