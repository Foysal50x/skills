# The Decision Gate

Run this before creating any Service, Repository, Query Class or Value Object, and produce a one-line justification naming the trigger. If you cannot name one, do not create the class.

**Default answer: keep it in the Action, use Eloquent directly.**

## Logic placement

| # | Question | If yes |
|---|----------|--------|
| Q0 | Is it a read with no state change, no transaction, no event and no second collaborator? | **No Action.** The entry point calls the Repository (or Eloquent) directly. |
| Q1 | Is it orchestrating a single end-to-end use case (HTTP or job entry → result)? | **Action** — `app/Domain/<Context>/Actions/<Verb><Noun>Action.php` |
| Q2 | Is it called from more than one Action, or complex enough to deserve testing in isolation from the orchestration? | **Service** — `app/Domain/<Context>/Services/<Name>Service.php` |
| Q3 | Is it used in only one Action? | **Keep it in that Action.** Do not extract. |

## Data access

| # | Question | If yes |
|---|----------|--------|
| Q4 | Is it single-record work — `find()`, a route-bound model, `create()`, `$model->update()`, `delete()`? | **Eloquent directly**, from an Action or a Repository. No interface. |
| Q5 | Is it either (a) likely to switch backends, or (b) named / important / reused / complex enough to deserve its own name and dedicated tests? | **Repository** — interface in `Contracts/`, implementation in `Repositories/`, complex queries delegated to `Queries/`. |

## Abstraction

| # | Question | If yes |
|---|----------|--------|
| Q6 | Are there two real implementations today, a concrete backend swap, or a host-owned extension point? | **Interface** — the narrowest contract the caller needs. Otherwise one concrete class. |
| Q7 | Do callers pick between those implementations by a key from config or a request? | **Factory or registry** — a map of key → closure building the client, throwing on an unknown key. |
| Q8 | Does only a subset of implementations need an extra step (uniqueness check, retry, cache warm)? | **A second opt-in contract** the base checks with `instanceof`. Never widen the shared interface. |

## Hard rules

- If Q4 and Q5 feel ambiguous, choose **Q4**. "Maybe someday" is not a trigger.
- A paginated, filtered or ownership-scoped **list is always Q5** — it has ordering, a page-size cap and an ownership constraint that must live in one place.
- "Eloquent directly" means from an **Action, a Repository or a Query Class**. Never from a Controller, Form Request, Resource, Blade view or Middleware.
- An Action that only forwards to one collaborator is not an Action. Delete it and let the entry point call the collaborator (Q0).
- An interface without an implementation and a container binding is not shippable. All three land together.
- The trigger for a Query Class and a Repository is the same. Never create a Query Class without a Repository around it; never create a Repository whose methods never delegate to one.
- Both extremes are bugs: a Repository for every model, and no repositories at all.
- An abstract base class is earned by shared *mechanism*, not by symmetry. Two implementations that share no code get an interface and nothing else.
- A configured class name is an extension seam only when Q6 already passed. Config chooses between real implementations; it does not create the contract.

## Layer one-liners

```
Controller / Action / Service / Command
        │ constructor injection
        ▼
  <X>RepositoryInterface        PUBLIC contract; swappable backend;
        │                       returns DOMAIN types; inputs are DTOs / VOs
        │ implemented by
        ▼
  Eloquent<X>Repository         composes query classes; Builder → domain type
        │ delegates named queries to
        ▼
  <Name>Query                   INTERNAL ONLY; one handle(); may return Builder
        │ whose inputs are
        ▼
  Value Objects / Filter DTOs   PURE data + PURE predicates;
                                NEVER touch Builder/Eloquent
```

| Layer | Job | Who may call it |
|-------|-----|-----------------|
| **Action** | Orchestrate one use case end to end | Controller, Job, Command |
| **Service** | One business decision reused by 2+ Actions | Actions, other Services |
| **Repository** | The only public data-access boundary | Actions, Services, Commands, and Controllers for plain reads |
| **Query Class** | One named query; the only place query construction lives | **Repository implementations only** |
| **Value Object** | Group related parameters; pure data + pure predicates | Any layer; read by Query Classes |
