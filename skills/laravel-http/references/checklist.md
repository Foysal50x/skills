# HTTP Layer Pre-Merge Checklist

Any "No" or "Unsure" means revise.

## Authorization

1. Is every non-public endpoint authorized before the Action runs?
2. Does every Form Request have a real `authorize()` — not the generator's `return true`?
3. Is every ownership rule defined in a Policy rather than inline conditionals?
4. Is every client-supplied ID constrained to what that caller may reach (scoped `Rule::exists`, relationship lookup, or a Policy check)?
5. For shallow nested routes, does the Policy actually check the parent relationship?

## Validation

6. Is validation in a Form Request rather than inline `$request->validate()`?
7. Are rules written as arrays rather than pipe strings?
8. Does every array input validate its items (`items.*`) and cap its size?
9. Is input normalized in `prepareForValidation()` so the rules see the canonical value?
10. Does the Form Request expose `toDto()` (or `toFilter()`), so the domain never receives a raw array?

## Routing

11. Are models resolved by route model binding rather than manual `findOrFail()`?
12. Does every nested route use `scopeBindings()`?
13. Does each route parameter name match the bound model (`{conversation}`, `{orderItem}`)?
14. Does `php artisan route:list` show the URLs you expect — no doubled prefixes, consistent plurals?
15. Do name prefixes end with a dot?
16. Is `route:cache` verified to succeed — no closure routes anywhere?

## Serialization

17. Does every JSON response go through a Resource rather than a raw Model or Collection?
18. Is every relation in a Resource guarded by `whenLoaded()` / `whenCounted()`?
19. Does the feeding query eager-load everything the Resource reads?
20. Are enums emitted as `->value`, dates as ISO 8601, money as an explicit amount plus currency?
21. Do Resources live in `Domain/<Context>/Resources/`?

## Errors

22. Are domain failures raised as context-specific exception classes with named constructors?
23. Is the exception-to-status mapping in `bootstrap/app.php` rather than in controllers?
24. Is `APP_DEBUG=false` in production?
25. Do 500-class responses return a stable message, with the detail sent to the log?

## Controllers

26. Is every controller method three to five lines — receive, convert, delegate, respond?
27. Does any controller contain `where()`, `orderBy()`, `with()` or `DB::`?
28. Does any controller open a transaction, dispatch a job, or send mail directly?
29. Is `Request` (or `$request->all()`) passed to anything beyond the controller?
