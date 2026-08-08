# Async Pre-Merge Checklist

Any "No" or "Unsure" means revise.

## Jobs

1. Is the handler safe to run twice — constraint, state guard, atomic operation or idempotency key?
2. Are `tries`, `backoff` and `timeout` set explicitly, with exponential backoff for anything on a network?
3. Does the job take identifiers rather than models or collections?
4. Does it handle the record being missing at handle time, without failing?
5. Is `failed()` implemented for anything a user is waiting on?
6. Should this job be unique, and if so does the cache driver support atomic locks?
7. Is fan-out a batch (with `then`/`catch`) and are ordered steps a chain?

## Events

8. Is the event past tense, `final readonly`, and immutable?
9. Does it carry identities and small Value Objects — no Eloquent Models, no aggregates?
10. Does every listener live in the consuming domain and touch only that domain's data?
11. Does every side-effecting listener implement `ShouldQueue`?
12. Is the event dispatched after the transaction commits?
13. Is each queued listener idempotent, as a job would be?

## Queues

14. Are jobs assigned to a queue by latency budget rather than all on `default`?
15. Is `QUEUE_CONNECTION` a real driver in production, and `sync` (or faked) in tests?
16. Does the deploy script run `queue:restart` (or `horizon:terminate`) after the new code lands?
17. Is any migration in this change backwards-compatible with in-flight jobs from the previous release?
18. Is something alerting on queue depth, oldest wait time and failed-job count?

## Caching

19. Does the cache key include every input that changes the result — tenant, user, locale, filter, version?
20. Is the fingerprint deterministic (sorted keys, stable serialization)?
21. Is there an invalidation path on write, not just a TTL?
22. Do bulk writes in this change flush the caches their skipped observers would have?
23. If tags are used, does the configured store support them?
24. Is an expensive hot key protected by a lock or `Cache::flexible()`?
25. Is caching in the Repository rather than the controller, and is it caching results rather than models?

## Scheduling

26. Does the scheduled entry dispatch jobs rather than doing the work inline?
27. Is `withoutOverlapping()` set, with an expiry longer than the worst run time?
28. Is `onOneServer()` set, with a shared atomic cache store and a common cache prefix?
29. Does the task ping a monitor on success and failure, so a task that stops running is noticed?
30. Has `php artisan schedule:list` been checked after this change?
