---
title: Route Jobs to Queues Centrally
impact: MEDIUM
impactDescription: queue assignment stops being scattered across call sites
tags: queues, routing, laravel-13, configuration
---

## Route Jobs to Queues Centrally

Laravel 13 adds `Queue::route()`, which declares the connection and queue for a job class in one place. Without it, queue assignment is either a property on every job or an `onQueue()` call at every dispatch site — and the one that gets forgotten is the one that matters.

Laravel 13 only. On Laravel 12, set `public string $queue` on the job class.

**Incorrect (assignment repeated, and inconsistent):**

```php
RebuildSearchIndex::dispatch($id)->onQueue('low');
RebuildSearchIndex::dispatch($other)->onQueue('default');   // forgotten
RebuildSearchIndex::dispatch($third);                       // forgotten entirely
```

**Correct (Laravel 13):**

```php
// app/Providers/QueueServiceProvider.php
use Illuminate\Support\Facades\Queue;

public function boot(): void
{
    Queue::route(RebuildSearchIndex::class, connection: 'redis', queue: 'low');
    Queue::route(GenerateMonthlyStatement::class, connection: 'redis', queue: 'low');
    Queue::route(SendPasswordReset::class, connection: 'redis', queue: 'high');
}
```

**Correct (Laravel 12):**

```php
final class RebuildSearchIndex implements ShouldQueue
{
    public string $queue = 'low';
    public string $connection = 'redis';
}
```

An explicit `onQueue()` at a call site still wins, which is the right precedence for the occasional deliberate override.
