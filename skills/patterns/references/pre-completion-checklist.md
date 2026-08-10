# Pre-Completion Self-Check

Run before declaring the work done. Any "No" or "Unsure" means revise.

## Placement

1. Did each new class pass the Decision Gate with a concrete, named justification?
2. **No premature Services** — is every Service used by 2+ Actions, or complex enough to test in isolation?
3. **No premature Repositories** — does every Repository have a concretely named backend-swap or named/reused/complex-query reason?
4. **No pass-through layers** — does any Action or Service `handle()` do nothing but forward its arguments to one collaborator?
5. **Contracts are complete** — does every interface added in this change have an implementation *and* a container binding?
6. **Reads placed correctly** — is every paginated or filtered list a named Repository method, with no query construction in a Controller, Form Request, Resource or Blade view?

## Query Classes

7. **Internal only** — is every `*Query` class imported only by files under `*/Repositories/`?
8. **Single public method** — does every Query Class expose exactly one public method, `handle()`?
9. **Business-question name** — is each named after a business question, not a DB operation (no `Get*`, no `Find*ById*`)?
10. **No generic base** — is there no abstract `Query` base class?
11. **Warranted** — does each meet at least one trigger (business meaning, multiple scopes, optional filters, eager loading, aggregates, pagination/ordering rules, reuse, dedicated tests, conditional write)?

## Value Objects and parameter isolation

12. **No long parameter lists, any layer** — does any method have more than 4 params, or related params not grouped?
13. **Value Objects are pure** — do `DateRange`, `Sorting` or any `*Filter` import or use `Builder` at all? They must not.
14. **No greedy wrappers** — no class wrapping a single unrelated scalar; no composite DTO for a 1–2 param query; essential domain objects passed directly?
15. **Presets via interface** — do named date ranges implement `DateRangable`, with parameterized presets instead of copy-pasted classes?

## Repository contract

16. **Domain return types** — do interface methods return domain types, never `Builder`?
17. **Domain inputs** — are interface inputs Value Objects or plain values, never `Request`?
18. **Interface scope** — is every Repository interface small (under ~6 methods) with intent-expressing method names?
19. **No BaseRepository** — is there no generic shared repository base or interface?

## Naming and layout

20. Actions `<Verb><Noun>Action`; Services `<Name>Service`; Repositories `<X>RepositoryInterface` + `<Backend><X>Repository`; Queries `<BusinessQuestion>Query`; Value Objects are nouns?
21. **Scope co-location** — generic code in top-level `app/Contracts/` and `app/Support/` only; single-domain code inside `app/Domain/<Context>/`; no top-level `Services/Repositories/Queries`; missing folders deliberate?
   Does any concept have two homes — a shared module holding another domain's messages, or the same class name under two domains?

## Inter-domain communication

22. **No cross-domain internals** — does any class `use App\Domain\<Other>\{Models,Repositories,Queries}`? Forbidden.
23. **No Model leaks** — does any cross-domain call return or pass another domain's Eloquent Model?
24. **Right pattern** — reactions via Domain Event; synchronous reads via an Open Host Service returning DTOs; shared concepts via the Shared Kernel; external sources via an Anti-Corruption Layer?
25. **Events are clean** — immutable, past-tense, carrying identity plus minimal data; listeners touch only their own domain; side-effecting listeners queued?
26. **Shared Kernel disciplined** — only universal, stable concepts with no domain behavior?

## Hygiene

27. Constructor injection throughout; no `app()` or service locator inside domain classes?
28. Sortable columns whitelisted at the Query Class level?
29. **Purity** — is all query construction inside Query Classes and Repositories, and are all Value Objects free of `Builder`?
30. **Configuration** — no `env()` outside `config/`; secrets in `.env`; structure in `config/*.php`?
31. **Tests** — can Repository consumers be unit-tested with a fake? Are Query Class rules tested against a real DB with factories? Are Value Object predicates covered purely?

For the Eloquent, HTTP, async and testing checklists, see the `laravel-skill:eloquent`, `laravel-skill:rest-api`, `laravel-skill:async` and `laravel-skill:testing` skills.
