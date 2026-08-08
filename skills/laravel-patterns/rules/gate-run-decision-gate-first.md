---
title: Run the Decision Gate Before Creating Any Class
impact: CRITICAL
impactDescription: prevents dead boilerplate layers
tags: gate, architecture, process
---

## Run the Decision Gate Before Creating Any Class

Before creating a Service, Repository, Query Class or Value Object, answer the gate questions in order and write a one-line justification naming the concrete trigger. If you cannot name one, the layer must not exist.

The gate, in order — stop at the first match:

```
─── LOGIC PLACEMENT ───
Q1. Orchestrating a single end-to-end use case (HTTP/job entry → result)?
    YES → ACTION

Q2. Called from MORE THAN ONE Action, or complex enough to deserve
    isolated tests?
    YES → SERVICE

Q3. Used in ONLY ONE Action?
    YES → KEEP IT IN THAT ACTION. Do not extract.

─── DATA ACCESS ───
Q4. Simple CRUD or a one-off read/write that will stay on Eloquent
    forever?
    YES → USE ELOQUENT DIRECTLY. No Repository, no Query Class,
          no interface.

Q5. Either (a) likely to switch backends, or (b) named / important /
    reused / complex enough to deserve its own name and tests?
    YES → REPOSITORY (interface + implementation), delegating
          complex queries to Query Classes.
```

Both extremes are bugs: a Repository for every model is dead boilerplate, and no repositories at all means queries scattered across Actions, Services and Blade.

**Incorrect (layer created by reflex, no trigger named):**

```php
// "Every model gets a repository" — Q4 was never asked.
final class UsageRecordRepository
{
    public function find(int $id): ?UsageRecord
    {
        return UsageRecord::find($id);
    }
}
```

**Correct (justification names the trigger, or the layer is not created):**

```php
// Justification: Q5(a) — chat history moves from MySQL to a vector store
// in phase 2, so the backend must be swappable behind one contract.
interface ChatRepositoryInterface
{
    public function relevantMessages(Conversation $conversation, string $prompt, int $limit = 10): Collection;
}

// UsageRecord failed Q5 entirely → no repository. Eloquent directly:
UsageRecord::create(['tenant_id' => $tenant->id, 'tokens' => $tokens]);
```

See `rules/gate-eloquent-directly-by-default.md` for the default branch.
