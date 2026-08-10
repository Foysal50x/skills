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
8. Does any job, notification or mailable constructor receive a password, API key, token or other credential? It must take an identifier instead.
9. Is `retry_after` on the connection longer than the longest `timeout` of any job that runs on it?
10. Does any job calling a third-party API carry a `RateLimited` middleware?

## Events

11. Is the event past tense, `final readonly`, and immutable?
12. Does it carry identities and small Value Objects — no Eloquent Models, no aggregates?
13. Does every listener live in the consuming domain and touch only that domain's data?
14. Does every side-effecting listener implement `ShouldQueue`?
15. Is the event dispatched after the transaction commits?
16. Is each queued listener idempotent, as a job would be?
17. Do notifications and mailables implement `ShouldQueue`, and call `afterCommit()` when dispatched inside a transaction?

## Queues

18. Are jobs assigned to a queue by latency budget rather than all on `default`?
19. Is `QUEUE_CONNECTION` a real driver in production, and `sync` (or faked) in tests?
20. Does the deploy script run `queue:restart` (or `horizon:terminate`) after the new code lands?
21. Is any migration in this change backwards-compatible with in-flight jobs from the previous release?
22. Is something alerting on queue depth, oldest wait time and failed-job count?

## Caching

23. Does the cache key include every input that changes the result — tenant, user, locale, filter, version?
24. Is the fingerprint deterministic (sorted keys, stable serialization)?
25. Is there an invalidation path on write, not just a TTL?
26. Do bulk writes in this change flush the caches their skipped observers would have?
27. If tags are used, does the configured store support them?
28. Is an expensive hot key protected by a lock or `Cache::flexible()`?
29. Is caching in the Repository rather than the controller, and is it caching results rather than models?
30. Is a value read repeatedly within one request memoized (`Cache::memo()` or `once()`) rather than fetched each time?

## Scheduling

31. Does the scheduled entry dispatch jobs rather than doing the work inline?
32. Is `withoutOverlapping()` set, with an expiry longer than the worst run time?
33. Is `onOneServer()` set, with a shared atomic cache store and a common cache prefix?
34. Does the task ping a monitor on success and failure, so a task that stops running is noticed?
35. Has `php artisan schedule:list` been checked after this change?
