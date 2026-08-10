---
title: Raw SQL Belongs Inside Query Classes and Repositories
impact: MEDIUM
impactDescription: keeps database-specific code in one replaceable layer
tags: raw-sql, joins, boundary, architecture
---

## Raw SQL Belongs Inside Query Classes and Repositories

JOINs, CTEs, window functions, aggregate selects and raw expressions are allowed and often necessary — for dashboard stats, charts, or anywhere Eloquent hydration is the bottleneck. They are allowed in exactly two places: Query Classes and Repository implementations.

Never in a Controller, Action, Service, Job or Blade view.

**Incorrect (a reporting query in the controller, unnamed and untestable):**

```php
final class DashboardController
{
    public function __invoke(): View
    {
        $rows = DB::select("
            SELECT date_format(created_at, '%Y-%m') AS month, sum(total) AS revenue
            FROM orders WHERE merchant_id = ? GROUP BY month
        ", [auth()->user()->merchant_id]);

        return view('dashboard', ['rows' => $rows]);
    }
}
```

**Correct (named query class, behind the repository):**

```php
namespace App\Domain\Orders\Queries;

final readonly class MonthlyRevenueQuery
{
    public function handle(int $merchantId, DateRange $period): Collection
    {
        return Order::query()
            ->selectRaw('date_format(created_at, ?) as month, sum(total) as revenue', ['%Y-%m'])
            ->where('merchant_id', $merchantId)
            ->when($period->from !== null, fn (Builder $q) => $q->where('created_at', '>=', $period->from))
            ->groupBy('month')
            ->orderBy('month')
            ->get();
    }
}
```

```php
$rows = $reports->monthlyRevenue($merchantId, (new LastNMonths(12))->range());
```

Cross-database date formatting has a better home than `selectRaw` — see `rules/raw-custom-expression-helpers.md`.
