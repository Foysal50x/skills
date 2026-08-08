---
title: Never Interpolate User Input Into Raw SQL
impact: CRITICAL
impactDescription: closes the SQL injection path raw SQL reopens
tags: security, sql-injection, raw-sql, bindings
---

## Never Interpolate User Input Into Raw SQL

The query builder parameterizes values, but `selectRaw`, `whereRaw`, `orderByRaw`, `havingRaw` and `DB::raw()` do not — whatever string you hand them becomes SQL. Pass values as bindings, and validate identifiers against an allow-list.

Identifiers (column and table names) cannot be bound at all. That is why sortable columns are whitelisted.

**Incorrect:**

```php
Order::whereRaw("number LIKE '%{$request->input('q')}%'")->get();

Order::orderByRaw($request->input('sort').' '.$request->input('dir'))->get();

DB::select("SELECT * FROM orders WHERE merchant_id = {$merchantId}");
```

**Correct:**

```php
Order::whereRaw('number LIKE ?', ['%'.$search.'%'])->get();

// Better still — no raw needed:
Order::where('number', 'like', '%'.$search.'%')->get();
```

```php
private const SORTABLE = ['created_at', 'number', 'total'];

$column = in_array($sorting->column, self::SORTABLE, true) ? $sorting->column : 'created_at';

Order::orderBy($column, $sorting->direction->value)->get();
```

`LIKE` wildcards in user input are a smaller, related issue: escape `%` and `_` when the search should be literal.
