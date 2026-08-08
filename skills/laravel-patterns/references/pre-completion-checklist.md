# Pre-Completion Self-Check

Run before declaring the work done. Any "No" or "Unsure" means revise.

## Placement

1. Did each new class pass the Decision Gate with a concrete, named justification?
2. **No premature Services** — is every Service used by 2+ Actions, or complex enough to test in isolation?
3. **No premature Repositories** — does every Repository have a concretely named backend-swap or named/reused/complex-query reason?

## Query Classes

4. **Internal only** — is every `*Query` class imported only by files under `*/Repositories/`?
5. **Single public method** — does every Query Class expose exactly one public method, `handle()`?
6. **Business-question name** — is each named after a business question, not a DB operation (no `Get*`, no `Find*ById*`)?
7. **No generic base** — is there no abstract `Query` base class?
8. **Warranted** — does each meet at least one trigger (business meaning, multiple scopes, optional filters, eager loading, aggregates, pagination/ordering rules, reuse, dedicated tests, conditional write)?

## Value Objects and parameter isolation

9. **No long parameter lists, any layer** — does any method have more than 4 params, or related params not grouped?
10. **Value Objects are pure** — do `DateRange`, `Sorting` or any `*Filter` import or use `Builder` at all? They must not.
11. **No greedy wrappers** — no class wrapping a single unrelated scalar; no composite DTO for a 1–2 param query; essential domain objects passed directly?
12. **Presets via interface** — do named date ranges implement `DateRangable`, with parameterized presets instead of copy-pasted classes?

## Repository contract

13. **Domain return types** — do interface methods return domain types, never `Builder`?
14. **Domain inputs** — are interface inputs Value Objects or plain values, never `Request`?
15. **Interface scope** — is every Repository interface small (under ~6 methods) with intent-expressing method names?
16. **No BaseRepository** — is there no generic shared repository base or interface?

## Naming and layout

17. Actions `<Verb><Noun>Action`; Services `<Name>Service`; Repositories `<X>RepositoryInterface` + `<Backend><X>Repository`; Queries `<BusinessQuestion>Query`; Value Objects are nouns?
18. **Scope co-location** — generic code in top-level `app/Contracts/` and `app/Support/` only; single-domain code inside `app/Domain/<Context>/`; no top-level `Services/Repositories/Queries`; missing folders deliberate?

## Inter-domain communication

19. **No cross-domain internals** — does any class `use App\Domain\<Other>\{Models,Repositories,Queries}`? Forbidden.
20. **No Model leaks** — does any cross-domain call return or pass another domain's Eloquent Model?
21. **Right pattern** — reactions via Domain Event; synchronous reads via an Open Host Service returning DTOs; shared concepts via the Shared Kernel; external sources via an Anti-Corruption Layer?
22. **Events are clean** — immutable, past-tense, carrying identity plus minimal data; listeners touch only their own domain; side-effecting listeners queued?
23. **Shared Kernel disciplined** — only universal, stable concepts with no domain behavior?

## Hygiene

24. Constructor injection throughout; no `app()` or service locator inside domain classes?
25. Sortable columns whitelisted at the Query Class level?
26. **Purity** — is all query construction inside Query Classes and Repositories, and are all Value Objects free of `Builder`?
27. **Configuration** — no `env()` outside `config/`; secrets in `.env`; structure in `config/*.php`?
28. **Tests** — can Repository consumers be unit-tested with a fake? Are Query Class rules tested against a real DB with factories? Are Value Object predicates covered purely?

For the Eloquent, HTTP, async and testing checklists, see the `laravel-eloquent`, `laravel-http`, `laravel-async` and `laravel-testing` skills.
