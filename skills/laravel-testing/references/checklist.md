# Testing Pre-Merge Checklist

Any "No" or "Unsure" means revise.

## Strategy

1. Does each new test use the style that fits its layer — fakes above the Repository, real database at and below it?
2. Does every test assert a decision *you* made, rather than framework behavior?
3. Did any test feel pointless to write? If so, does the class under test need to exist?
4. Do unit tests avoid the database entirely (`uses()` scoped to `Feature`/`Integration` only)?

## Fakes

5. Are Repository doubles hand-written anonymous classes rather than mock chains?
6. Is every external boundary faked — `Queue`, `Bus`, `Event`, `Mail`, `Notification`, `Http`, `Storage`?
7. Does `Event::fake()` name the specific event classes rather than suppressing everything?
8. Is Eloquent or the query builder mocked anywhere? It must not be.
9. Is time frozen or travelled for anything date-dependent?
10. Is `Http::preventStrayRequests()` on, with every outbound call faked — including the failure paths?
11. Are queued mailables asserted with `assertQueued()` rather than `assertSent()`?

## Database tests

12. Does each filter test include at least one row that must be excluded, per condition?
13. Do assertions compare exact id lists rather than only counts?
14. Is the default ordering asserted?
15. Is an unwhitelisted sort column asserted to fall back rather than reach `orderBy`?
16. Are the relations the Resource reads asserted as loaded, or covered by a query-count test?
17. Is rollback tested for at least one multi-step write?
18. Is idempotency tested for every queued handler that writes or charges?

## Feature tests

19. Does every protected endpoint have unauthenticated, unpermitted and other-tenant cases?
20. Do authorization tests assert that state did not change, not only the status code?
21. Is the response payload structure asserted, including keys that must not appear?
22. Are validation failures asserted with `assertJsonValidationErrors`?
23. Are queued jobs and dispatched events asserted, including the target queue?
24. Is "nothing is dispatched on the failure path" asserted where it matters?

## Value Objects

25. Are predicates and transformations tested directly, with no database or container?
26. Does any Value Object test require a `Builder`? If so, the Value Object violates the purity rule.
27. Are boundary values covered — inclusive edges, null bounds, empty ranges?

## Suite health

28. Does the suite run in parallel (`--parallel`)?
29. Is `Model::shouldBeStrict()` enabled in the test environment?
30. Does CI run the integration suite against the production database engine?
31. Are there any tests that fail depending on the time of day or day of month?
