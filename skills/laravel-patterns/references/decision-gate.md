# The Decision Gate

Run this before creating any Service, Repository, Query Class or Value Object, and produce a one-line justification naming the trigger. If you cannot name one, do not create the class.

**Default answer: keep it in the Action, use Eloquent directly.**

## Logic placement

| # | Question | If yes |
|---|----------|--------|
| Q1 | Is it orchestrating a single end-to-end use case (HTTP or job entry → result)? | **Action** — `app/Domain/<Context>/Actions/<Verb><Noun>Action.php` |
| Q2 | Is it called from more than one Action, or complex enough to deserve testing in isolation from the orchestration? | **Service** — `app/Domain/<Context>/Services/<Name>Service.php` |
| Q3 | Is it used in only one Action? | **Keep it in that Action.** Do not extract. |

## Data access

| # | Question | If yes |
|---|----------|--------|
| Q4 | Is it simple CRUD, or a one-off read/write that will almost certainly stay on Eloquent forever? | **Eloquent directly.** No Repository, no Query Class, no interface. |
| Q5 | Is it either (a) likely to switch backends, or (b) named / important / reused / complex enough to deserve its own name and dedicated tests? | **Repository** — interface in `Contracts/`, implementation in `Repositories/`, complex queries delegated to `Queries/`. |

## Hard rules

- If Q4 and Q5 feel ambiguous, choose **Q4**. "Maybe someday" is not a trigger.
- The trigger for a Query Class and a Repository is the same. Never create a Query Class without a Repository around it; never create a Repository whose methods never delegate to one.
- Both extremes are bugs: a Repository for every model, and no repositories at all.

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
| **Repository** | The only public data-access boundary | Actions, Services, Commands |
| **Query Class** | One named query; the only place query construction lives | **Repository implementations only** |
| **Value Object** | Group related parameters; pure data + pure predicates | Any layer; read by Query Classes |
