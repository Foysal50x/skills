---
title: Set the SQS Visibility Timeout on the Queue, Not in config/queue.php
impact: HIGH
impactDescription: stops SQS handing a still-running job to a second worker
tags: queues, sqs, configuration, duplication, aws
---

## Set the SQS Visibility Timeout on the Queue, Not in config/queue.php

On `redis`, `database` and `beanstalkd`, `retry_after` decides when a reserved job is considered dead. SQS has no such key: the lease is the queue's **Default Visibility Timeout**, held in AWS. Adding `retry_after` to the `sqs` connection changes nothing, and the config file then reads as if the problem were handled.

The default visibility timeout is 30 seconds. Any job that runs longer is redelivered while the first copy is still working.

**Incorrect (a setting SQS never reads, next to a job that outlives the lease):**

```php
// config/queue.php
'sqs' => [
    'driver' => 'sqs',
    'queue' => env('SQS_QUEUE', 'default'),
    'retry_after' => 300,   // ignored — SQS does not use this
],
```

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 240;   // redelivered at 30s, four more times before it finishes
}
```

**Correct (the lease lives with the queue, and the job declares its own ceiling):**

```bash
aws sqs set-queue-attributes \
  --queue-url "$SQS_REPORTS_URL" \
  --attributes VisibilityTimeout=600
```

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 240;                 // well inside the 600s lease
    public string $connection = 'sqs-reports';
}
```

One queue per timeout class, exactly as with `retry_after`: a 600-second lease on the queue carrying password-reset emails means a genuinely stuck job blocks that message for ten minutes.

SQS also caps a message at 12 hours of total visibility extension and 14 days of retention — work that outlives either belongs in a chunked, resumable job. The general rule is `rules/job-retry-after-exceeds-timeout.md`; this is what it means on SQS.
