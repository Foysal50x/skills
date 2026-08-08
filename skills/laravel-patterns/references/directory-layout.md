# Directory and Namespace Layout

Domain-first. Each domain has only the folders it needs; a missing folder is a decision.

```
app/
  Contracts/                     generic, cross-cutting INTERFACES
    DateRangable.php
  Support/                       generic, cross-domain value objects
    Filters/
      Date/
        DateRange.php
        Presets/
          Today.php  ThisWeek.php  ThisMonth.php  LastMonth.php
          LastNMonths.php  PreviousNDays.php  ThisYear.php  LastYear.php
      Sorting.php                lone pair → root of Filters/
      Direction.php
    Query/
      DateFmt.php                driver-aware SQL expression helper
  Infrastructure/                adapters for external systems (ACL)
    AiProvider/
      AiProviderInterface.php
      OpenAiProvider.php
  Domain/
    Chat/
      Contracts/                 DOMAIN-SPECIFIC interfaces + cross-domain DTOs
        ChatRepositoryInterface.php
      Actions/
        SubmitPromptAction.php
      Services/
        AiProviderRouterService.php
        ConversationContextService.php
      Repositories/              implementations ONLY
        EloquentChatRepository.php
        VectorStoreChatRepository.php
      Queries/                   INTERNAL; imported ONLY by Repositories/
        RecentMessagesQuery.php
        RelevantMessagesBySimilarityQuery.php
      Models/
        Conversation.php  Message.php  Tenant.php
    Orders/
      Contracts/
        OrderRepositoryInterface.php
        OrderIntegrationInterface.php    public cross-domain surface
        OrderSummaryDTO.php
      Actions/
      Services/
      Repositories/
        EloquentOrderRepository.php
      Queries/
        SearchOrdersQuery.php  PendingOrdersQuery.php
        ExpireAbandonedOrdersQuery.php
      Filters/
        OrderQueryFilter.php
      Events/
        OrderPlaced.php
      Listeners/                 this domain's reactions to others' events
      Resources/
        OrderResource.php
      Exceptions/
        OrderException.php
      Concern/                   domain traits
      Support/                   domain helpers, incl. Support/Query/
      Models/
        Order.php
    Billing/
      Actions/
        RecordUsageAction.php
      Services/
        UsageCalculatorService.php
      Listeners/
        RecordOrderUsage.php
      Models/
        UsageRecord.php
      # No Contracts/Repositories/Queries/Filters — deliberate; billing is
      # simple CRUD and no query here has earned a name.
```

## Rules

- Top-level `app/Contracts/` holds only generic, shareable interfaces. Top-level `app/Support/` holds only generic, shareable Value Objects and query-expression helpers. Anything used by a single domain belongs inside that domain.
- `Queries/` is internal: only that domain's `Repositories/` may import from it.
- Generic Value Objects are grouped by concept under `app/Support/Filters/<Concept>/`. A lone Value Object may sit at the `Filters/` root.
- Never create top-level `app/Services/`, `app/Repositories/` or `app/Queries/`.
- Model scopes are fine for small reusable constraints; a Query Class may compose them.

## CI guards

```bash
# No top-level layer buckets
test ! -d app/Services && test ! -d app/Repositories && test ! -d app/Queries

# Query Classes imported only by Repositories
grep -rln 'use App\\Domain\\[A-Za-z]*\\Queries\\' app --include='*.php' \
  | grep -v '/Repositories/' && exit 1 || true

# No env() outside config/
grep -rn '\benv(' app routes database --include='*.php' && exit 1 || true
```
