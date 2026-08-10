---
title: Alert When a Scheduled Task Stops Running
impact: MEDIUM
impactDescription: catches the failure mode where nothing happens at all
tags: scheduling, monitoring, observability, alerting
---

## Alert When a Scheduled Task Stops Running

A failing task logs an error. A task that stops being scheduled — because the cron entry was lost in a deploy, the container has no cron, or an overlap lock was never released — produces no signal at all. Nobody notices until the monthly invoices do not go out.

Ping an external monitor on success and on failure, so silence itself is the alert.

**Incorrect (no signal either way):**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00')->onOneServer();
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())
    ->monthlyOn(1, '02:00')
    ->onOneServer()
    ->withoutOverlapping()
    ->pingOnSuccess(config('monitoring.statements_heartbeat'))
    ->pingOnFailure(config('monitoring.statements_alert'))
    ->emailOutputOnFailure(config('alerts.ops_email'));
```

```php
// Local visibility as well as external:
Schedule::command('orders:expire-abandoned')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/schedule-expire.log'));
```

Verify the schedule itself after every deploy: `php artisan schedule:list` shows the registered tasks and their next run times.
