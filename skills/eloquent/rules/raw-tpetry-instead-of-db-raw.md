---
title: Replace DB::raw With Type-Safe Query Expressions
impact: MEDIUM
impactDescription: removes hand-built SQL strings from the query layer
tags: raw-sql, expressions, tpetry, packages
---

## Replace DB::raw With Type-Safe Query Expressions

`tpetry/laravel-query-expressions` provides composable, driver-aware expression objects usable in `where()`, `select()`, `update()`, aggregates and schema definitions. Prefer them over `DB::raw()`: they are typed, they escape identifiers, and they compile correctly on MySQL, Postgres, SQLite and SQL Server.

Requires `^1.6` for Laravel 13 support. Still query construction, so still only inside Query Classes and Repositories.

**Incorrect (string SQL, one dialect, no escaping):**

```php
Movie::selectRaw("count(case when released = 2021 then 1 end) as released_2021")
    ->selectRaw("count(case when genre = 'Drama' then 1 end) as genre_drama")
    ->where('streamingservice', 'netflix')
    ->get();

$quota->update(['credits' => DB::raw('credits - 15')]);
```

**Correct:**

```php
use Tpetry\QueryExpressions\Function\Aggregate\CountFilter;
use Tpetry\QueryExpressions\Operator\Comparison\Equal;
use Tpetry\QueryExpressions\Operator\Arithmetic\Subtract;
use Tpetry\QueryExpressions\Language\{Alias, Value};

Movie::select([
    new Alias(new CountFilter(new Equal('released', new Value(2021))), 'released_2021'),
    new Alias(new CountFilter(new Equal('genre', new Value('Drama'))), 'genre_drama'),
])->where('streamingservice', 'netflix')->get();

$quota->update(['credits' => new Subtract('credits', new Value(15))]);
```

Available groups: value/wrap (`Value`, `Alias`), CASE (`CaseGroup`, `CaseRule`), arithmetic (`Add`, `Subtract`, `Multiply`, `Divide`, `Modulo`, `Power`), comparison (`Equal`, `GreaterThan`, `Between`, `IsNull`, …), logical (`CondAnd`, `CondOr`, `CondNot`), bitwise, aggregates (`Count`, `CountFilter`, `Sum`, `SumFilter`, `Avg`, `Min`, `Max`), conditional (`Coalesce`, `Greatest`, `Least`), string (`Concat`, `Lower`, `Upper`, `Uuid4`), time (`Now`, `ExtractDatePart`, `TimestampBin`), math (`Abs`).
