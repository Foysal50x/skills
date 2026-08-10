# HTTP Layer Pre-Merge Checklist

Any "No" or "Unsure" means revise.

## Authorization

1. Is every non-public endpoint authorized before the Action runs?
2. Is each route authorized in exactly one place — no Form Request `authorize()` *and* a controller `Gate::authorize()` on the same route?
3. Where two checks exist, do they check genuinely different things (group membership vs record ownership) rather than the same ability twice?
4. Does every Form Request have a real `authorize()` — not the generator's `return true`?
5. Is every ownership rule defined in a Policy rather than inline conditionals?
6. Is every client-supplied ID constrained to what that caller may reach (scoped `Rule::exists`, relationship lookup, or a Policy check)?
7. For shallow nested routes, does the Policy actually check the parent relationship?

## Validation

8. Is validation in a Form Request rather than inline `$request->validate()`?
9. Are rules written as arrays rather than pipe strings?
10. Does every array input validate its items (`items.*`) and cap its size?
11. Is input normalized in `prepareForValidation()` so the rules see the canonical value?
12. Does the Form Request expose `toDto()` (or `toFilter()`), so the domain never receives a raw array?

## Routing

13. Are models resolved by route model binding rather than manual `findOrFail()`?
14. Does every nested route use `scopeBindings()`?
15. Does each route parameter name match the bound model (`{conversation}`, `{orderItem}`)?
16. Does `php artisan route:list` show the URLs you expect — no doubled prefixes, consistent plurals?
17. Do name prefixes end with a dot?
18. Is `route:cache` verified to succeed — no closure routes anywhere?

## Serialization

19. Does every JSON response go through a Resource rather than a raw Model or Collection?
20. Is every relation in a Resource guarded by `whenLoaded()` / `whenCounted()`?
21. Does the feeding query eager-load everything the Resource reads?
22. Are enums emitted as `->value`, dates as ISO 8601, money as an explicit amount plus currency?
23. Do Resources live in `Domain/<Context>/Resources/`?

## Errors

24. Are domain failures raised as context-specific exception classes with named constructors?
25. Is the exception-to-status mapping in `bootstrap/app.php` rather than in controllers?
26. Is `APP_DEBUG=false` in production?
27. Do 500-class responses return a stable message, with the detail sent to the log?
28. Is every parameter carrying a password, token, key or raw personal data marked `#[\SensitiveParameter]`?
29. Is any secret interpolated into an exception message, or passed to a queued job or notification constructor?

## Controllers

30. Is every controller method three to five lines — receive, convert, delegate, respond?
31. Does any controller contain `where()`, `orderBy()`, `with()`, `paginate()` or `DB::` — including a relation read off `$request->user()`?
32. Does any controller open a transaction, dispatch a job, or send mail directly?
33. Is `Request` (or `$request->all()`) passed to anything beyond the controller?

## Outbound HTTP

34. Does every outbound call set `timeout()` and `connectTimeout()`?
35. Is each response either `throw()`n or matched on status — never `json()`ed unchecked?
36. Does every retried write carry an idempotency key the upstream honours?
37. Are retries limited to connection errors and 5xx, with increasing delays?
38. Are independent calls pooled rather than awaited one after another?
39. Does the adapter translate upstream failures into a domain exception?
