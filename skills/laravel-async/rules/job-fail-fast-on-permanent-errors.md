---
title: Fail Permanent Errors Immediately Instead of Retrying Them
impact: HIGH
impactDescription: a poison job stops consuming the retry budget of every healthy one
tags: jobs, failures, retries, dead-letter, resilience
---

## Fail Permanent Errors Immediately Instead of Retrying Them

A 422 from a validation error, a deleted record, a malformed payload from an old release — none of these get better on the fourth attempt. Retrying them burns worker time, delays healthy jobs behind them, and buries the real signal under repeated identical exceptions.

Separate the two classes of failure at the throw site: transient (retry) and permanent (stop now).

**Incorrect (a permanently invalid payload retried five times over half an hour):**

```php
public function handle(CrmClient $crm): void
{
    $contact = Contact::find($this->contactId);

    $crm->upsert($contact->toArray());   // 422 from the provider, retried until $tries runs out
}
```

**Correct (permanent failures end the job on the first attempt):**

```php
final class SyncContactToCrm implements ShouldQueue
{
    public int $tries = 5;

    public function handle(ContactRepositoryInterface $contacts, CrmClient $crm): void
    {
        $contact = $contacts->findForSync($this->contactId);

        if ($contact === null) {
            $this->delete();   // deleted since dispatch — nothing to retry
            return;
        }

        try {
            $crm->upsert($contact);
        } catch (CrmRejectedPayload $e) {
            $this->fail($e);   // straight to failed_jobs, no further attempts
        }
    }
}
```

`$this->delete()` drops a job that no longer has work to do; `$this->fail($e)` records it in `failed_jobs` with its exception so it can be inspected and replayed. Both skip the remaining attempts.

`failed_jobs` is the dead-letter queue — treat it as one. Alert on arrivals rather than on depth, prune it on a schedule, and fix the cause before `queue:retry`. See `rules/job-handle-failure-explicitly.md` for what `failed()` should do when the job does exhaust its attempts.
