# rest-api

REST API and HTTP-edge rules for Laravel — authorization before the domain runs, validation and DTO construction in Form Requests, scoped route model binding for nested resources, JSON output through Resources, thin controllers, and domain exceptions mapped to status codes centrally. Use when writing or reviewing routes, controllers, form requests, API resources, policies or exception handling in a Laravel application.

> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.

---

# 1. Authorization

**Impact: CRITICAL**

Every request that reads or writes tenant-scoped data is authorized before the domain runs. An ID in a request body is a claim, not a fact.

---

## Authorize Before the Domain Runs

Every request that reads or writes non-public data is authorized at the edge, before the Action executes. The three places that qualify: a Form Request's `authorize()`, a controller `authorize()` call, or route middleware. Choose one of them per route and only one — see `rules/authz-exactly-one-authorization-site.md`.

Authorization inside the Action is too late in one important way — it mixes the access decision with the use case, so the same Action called from a console command silently enforces a user policy that has no user.

**Incorrect (the write happens, then the check):**

```php
final class UpdateOrderController
{
    public function __invoke(Request $request, Order $order, UpdateOrderAction $action): JsonResponse
    {
        $order = $action->handle($order, $request->validated());

        abort_unless($request->user()->can('update', $order), 403);   // already updated

        return response()->json(new OrderResource($order));
    }
}
```

**Correct (Form Request decides, then the Action runs):**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }
}

final class UpdateOrderController
{
    public function __invoke(UpdateOrderRequest $request, Order $order, UpdateOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($order, $request->toDto())));
    }
}
```

Laravel 13 adds `#[Authorize]` on controller methods — see `rules/controller-attributes-for-middleware-and-authorization.md`.

---

## Authorize in Exactly One Place per Route

Every route is authorized once. Not zero times, and not twice.

A duplicated check is not extra safety. The two sites name different abilities sooner or later, so whichever runs first decides and the other is decoration — decoration nobody can delete safely, because the route still looks guarded in review.

| The route | Authorize in |
|-----------|--------------|
| has a Form Request | that request's `authorize()` |
| takes no body (DELETE, a POST toggle) | `#[Authorize]` (Laravel 13) or `Gate::authorize()` as the controller's first line |
| shares a rule with its group (tenant membership, subscription) | route middleware, once, on the group |

Two sites are correct only when they check different things — group middleware for membership plus a per-record ownership check. Never the same ability twice.

**Incorrect (two decisions, two different abilities):**

```php
public function authorize(): bool     // ReopenTodoRequest
{
    return $this->user()?->can('update', $this->route('todo')) ?? false;
}

public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
{
    Gate::authorize('complete', $todo);   // second decision, different ability

    return TodoResource::make($this->reopenTodo->handle($todo));
}
```

**Correct (one site — the request, because this route has one):**

```php
public function authorize(): bool     // ReopenTodoRequest
{
    return $this->user()?->can('reopen', $this->route('todo')) ?? false;
}

public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
{
    return TodoResource::make($this->reopenTodo->handle($todo));   // no second check
}
```

With no Form Request, the single site is the controller's first line — `Gate::authorize('delete', $todo);` — and nothing else checks that ability.

A Form Request shared by two routes stays one site — branch inside `authorize()` rather than adding a controller check for the route that has a bound model:

```php
// POST /todos (nothing to own yet) and POST /todos/{todo}/subtasks (owned parent).
return ! ($todo = $this->route('todo')) instanceof Todo || ($this->user()?->can('update', $todo) ?? false);
```

See `rules/authz-check-before-the-domain-runs.md` and `rules/authz-policies-per-model.md`.

---

## An ID in a Request Is a Claim, Not a Fact

`exists:orders,id` proves the row exists. It does not prove the caller may touch it. Every ID arriving from the client must be constrained to what that caller can reach — through a scoped relationship query, a global tenant scope, or a policy check on the resolved model.

**Incorrect (validated, existing, and belonging to someone else):**

```php
public function rules(): array
{
    return ['order_id' => ['required', 'integer', 'exists:orders,id']];
}

$order = Order::findOrFail($request->integer('order_id'));   // any tenant's order
```

**Correct (scope the lookup to the caller):**

```php
public function rules(): array
{
    return [
        'order_id' => [
            'required',
            'integer',
            Rule::exists('orders', 'id')->where('merchant_id', $this->user()->merchant_id),
        ],
    ];
}
```

```php
// Or resolve through the relationship, so the constraint is structural:
$order = $request->user()->merchant->orders()->findOrFail($request->integer('order_id'));
```

The same applies to nested route parameters — see `rules/route-scoped-bindings-for-nested-resources.md` — and to any `whereIn` built from client input.

---

## Put the Rule in a Policy, Not in a Conditional

Inline ownership checks drift. The controller checks `owner_id`, the Blade view forgets the tenant, and the API endpoint added last month checks neither. A Policy gives the rule one definition that every check shares.

Policies are auto-discovered by naming convention, or bound with `#[UsePolicy]` on the model.

**Incorrect (the same rule, three versions, one of them wrong):**

```php
// Controller
if ($order->merchant_id !== $request->user()->merchant_id) { abort(403); }

// Blade
@if ($order->merchant_id === auth()->user()->merchant_id) ... @endif

// API controller — forgot the archived check
if ($order->merchant_id === auth()->id()) { /* wrong column entirely */ }
```

**Correct:**

```php
final class OrderPolicy
{
    public function view(User $user, Order $order): bool
    {
        return $user->merchant_id === $order->merchant_id;
    }

    public function update(User $user, Order $order): bool
    {
        return $this->view($user, $order) && $order->status === OrderStatus::Pending;
    }
}
```

```php
$this->authorize('update', $order);       // controller
@can('update', $order) ... @endcan        // Blade
$user->can('update', $order);             // anywhere
```

Return `Response::deny('...')` instead of `false` when the user deserves to know why.

---

# 2. Form Requests and Validation

**Impact: HIGH**

Validation lives in Form Requests, which also carry authorization and produce the DTO the domain consumes. HTTP stops there.

---

## Validate Array Items, Not Just the Array

`'items' => 'required|array'` validates that `items` is an array and nothing else. Every element, and every key inside every element, passes through unchecked — including keys you never intended to accept.

Validate each element with `items.*`, and close the shape so unexpected keys are rejected rather than carried along.

**Incorrect (element shape unvalidated; a `price` key rides along into the DTO):**

```php
public function rules(): array
{
    return [
        'items' => ['required', 'array', 'min:1'],
    ];
}

// Payload: [{"sku": "A1", "quantity": 1, "price": 0}]
```

**Correct:**

```php
public function rules(): array
{
    return [
        'items' => ['required', 'array', 'min:1', 'max:100'],
        'items.*' => ['array:sku,quantity'],           // exactly these keys
        'items.*.sku' => ['required', 'string', 'max:64', 'exists:products,sku'],
        'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
    ];
}
```

Two things worth adding on any array input: a `max` on the array itself (an unbounded array is a denial-of-service vector), and `exists` scoped to what the caller may reach — see `rules/authz-never-trust-request-ids.md`.

---

## Put the Authorization Decision in authorize()

`authorize()` runs before `rules()` and before the controller. Returning `false` produces a 403 with no further work done. This is the cheapest place to stop a request.

Never leave it as `return true` on an endpoint that touches non-public data — that is the default the generator writes, and it is how endpoints ship unauthorized.

**Incorrect:**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;      // generator default, never revisited
    }
}
```

**Correct:**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }
}
```

```php
// Creating, where there is no instance yet:
public function authorize(): bool
{
    return $this->user()?->can('create', Order::class) ?? false;
}
```

The `?->` and `?? false` matter: an unauthenticated request has no user, and `null->can()` would be a `TypeError` rather than a 403.

Once the decision is here, it is only here. Do not repeat it in the controller with `Gate::authorize()` — see `rules/authz-exactly-one-authorization-site.md`.

---

## The Request Stops at the Controller

`Illuminate\Http\Request` — and `FormRequest`, and `$request->all()` — do not travel past the controller. Actions, Services, Repositories and Query Classes take DTOs, Value Objects or plain values.

The test is simple: can a console command call this Action? If it would have to fabricate a `Request`, the boundary is in the wrong place.

**Incorrect:**

```php
final readonly class PlaceOrderAction
{
    public function handle(Request $request): Order { /* ... */ }
}

// The nightly CSV importer now does this:
$action->handle(Request::create('/orders', 'POST', $row));
```

**Correct:**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order { /* ... */ }
}
```

```php
// HTTP:
$action->handle($request->toDto());

// Console:
$action->handle(new CreateOrderData(customerId: $row['customer_id'], items: $row['items']));

// Test:
$action->handle(new CreateOrderData(customerId: 1, items: [['sku' => 'A1', 'quantity' => 2]]));
```

The same rule applies to `auth()->user()` inside domain classes: pass the user, or the identity, as a parameter.

---

## Normalize Input in prepareForValidation

Trimming, lower-casing, stripping formatting and coercing empty strings to `null` belong in `prepareForValidation()`, which runs before the rules. Doing it after validation means the rules ran against the wrong value; doing it in the Action means every caller repeats it.

Use `passedValidation()` for adjustments that only make sense once the input is known valid.

**Incorrect (rules see the raw value; normalization happens too late):**

```php
public function rules(): array
{
    return ['email' => ['required', 'email', 'unique:users,email']];
}

// ' Foysal@Example.COM ' passes `unique`, then is lower-cased on save,
// colliding with an existing row.
```

**Correct:**

```php
protected function prepareForValidation(): void
{
    $this->merge([
        'email' => Str::lower(trim((string) $this->input('email'))),
        'phone' => preg_replace('/\D+/', '', (string) $this->input('phone')),
        'note' => $this->filled('note') ? trim((string) $this->input('note')) : null,
    ]);
}

public function rules(): array
{
    return [
        'email' => ['required', 'email', 'unique:users,email'],
        'phone' => ['required', 'digits_between:10,15'],
        'note' => ['nullable', 'string', 'max:2000'],
    ];
}
```

Keep the normalization mechanical. Anything that needs a domain decision belongs in the Action.

---

## Convert the Validated Payload into a DTO

`validated()` returns `array<string, mixed>`. Handing that to an Action gives up every type guarantee and makes the Action's contract "some array, probably with these keys".

A `toDto()` method on the Form Request converts once, at the boundary. The Action then declares exactly what it needs, and static analysis can check it.

**Incorrect (untyped array travels inward):**

```php
public function handle(array $data): Order
{
    $customer = Customer::find($data['customer_id']);   // string? int? missing?
    // ...
}
```

**Correct:**

```php
namespace App\Domain\Orders\Actions;

final readonly class CreateOrderData
{
    /** @param array<int, array{sku: string, quantity: int}> $items */
    public function __construct(
        public int $customerId,
        public array $items,
        public ?string $note = null,
    ) {}
}
```

```php
public function toDto(): CreateOrderData
{
    return new CreateOrderData(
        customerId: (int) $this->validated('customer_id'),
        items: $this->validated('items'),
        note: $this->validated('note'),
    );
}

public function handle(CreateOrderData $data): Order { /* ... */ }
```

For read endpoints the equivalent is a filter Value Object — see the `laravel-skill:patterns` skill.

---

## Validation Lives in a Form Request

Inline `$request->validate()` mixes the input contract with the controller's job, cannot be reused by a second endpoint, and cannot be unit-tested without a full HTTP round trip. A Form Request holds the rules, the authorization decision, input normalization and the DTO conversion.

Name it after the action: `StoreOrderRequest`, `UpdateOrderRequest`, `SearchOrdersRequest`.

**Incorrect:**

```php
final class StoreOrderController
{
    public function __invoke(Request $request, PlaceOrderAction $action): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'items' => 'required|array|min:1',
        ]);

        return response()->json(new OrderResource($action->handle(CreateOrderData::fromArray($data))), 201);
    }
}
```

**Correct:**

```php
final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Order::class) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function toDto(): CreateOrderData
    {
        return new CreateOrderData(
            customerId: (int) $this->validated('customer_id'),
            items: $this->validated('items'),
        );
    }
}
```

Prefer array rule syntax over pipe strings: it survives rules that contain a `|`, such as regexes and `Rule` objects.

---

# 3. Routing and Model Binding

**Impact: HIGH**

Route model binding removes lookup boilerplate — and scoped binding turns a nested URL into an enforced parent-child relationship instead of a suggestion.

---

## Point Every Route at a Controller Class

`php artisan route:cache` cannot serialize closures. One closure route anywhere in `routes/` makes the command fail, and the usual response is to drop route caching from the deploy — losing it for the whole application.

Every route resolves to a controller class, including health checks and redirects.

**Incorrect:**

```php
Route::get('/health', fn () => response()->json(['ok' => true]));

Route::get('/docs', fn () => redirect('https://docs.example.test'));
```

**Correct:**

```php
Route::get('/health', HealthController::class);

Route::redirect('/docs', 'https://docs.example.test');    // no closure involved
Route::view('/about', 'pages.about');
```

```php
final class HealthController
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['ok' => true, 'version' => config('app.version')]);
    }
}
```

Verify before shipping: `php artisan route:cache && php artisan route:clear`. See the `laravel-skill:patterns` skill for the rest of the production cache set.

---

## Keep Prefixes and Paths Consistent

A group prefix plus a path that repeats it produces a double-nested URL. The route still registers, so nothing fails — the endpoint is simply at an address nobody expects, and the singular/plural inconsistency spreads to every generated link.

Convention: plural in the URI segment, singular in the parameter.

**Incorrect (prefix repeated, singular and plural mixed):**

```php
Route::prefix('conversations')->group(function (): void {
    Route::get('/conversations', ConversationIndexController::class);       // /conversations/conversations
    Route::get('/conversation/{conversation}', ConversationShowController::class); // /conversations/conversation/1
});
```

**Correct:**

```php
Route::prefix('conversations')->name('conversations.')->group(function (): void {
    Route::get('/', ConversationIndexController::class)->name('index');
    Route::post('/', ConversationStoreController::class)->name('store');

    Route::prefix('{conversation}')->scopeBindings()->group(function (): void {
        Route::get('/', ConversationShowController::class)->name('show');
        Route::get('/messages', MessageIndexController::class)->name('messages.index');
        Route::get('/messages/{message}', MessageShowController::class)->name('messages.show');
    });
});
```

Verify with `php artisan route:list --path=conversations` after any group change. The name prefix must end with a dot, or names concatenate into `conversationsindex`.

---

## Handle a Missing Bound Model Deliberately

Implicit binding aborts with 404 when the model is not found. For an API that is correct. For a web route where the record was just deleted, or where the URL came from a stale email, a redirect with a message is better.

`missing()` takes a closure invoked instead of the 404.

**Incorrect (a bare 404 page for a link that used to work):**

```php
Route::get('/orders/{order}', OrderShowController::class);
// Order cancelled and purged → user gets a blank 404.
```

**Correct:**

```php
Route::get('/orders/{order}', OrderShowController::class)
    ->missing(fn (Request $request) => redirect()
        ->route('orders.index')
        ->with('warning', 'That order is no longer available.'));
```

```php
// Withdrawn resources that should say so:
Route::get('/invitations/{invitation}', InvitationShowController::class)
    ->missing(fn () => response()->view('invitations.expired', status: 410));
```

Keep 404 for API routes: a machine client should not be redirected to HTML.

---

## Bind Route Models Instead of Looking Them Up

Type-hint the model and Laravel resolves it from the route parameter, returning 404 when it does not exist. Manual `findOrFail()` in every method repeats the lookup and drifts — one method uses `find()` and returns a 500 on null.

Bind by a non-key column with `getRouteKeyName()` or inline in the route.

**Incorrect:**

```php
Route::get('/orders/{id}', [OrderController::class, 'show']);

public function show(int $id): JsonResponse
{
    $order = Order::find($id);          // null → 500 in the Resource

    return response()->json(new OrderResource($order));
}
```

**Correct:**

```php
Route::get('/orders/{order}', OrderShowController::class);

final class OrderShowController
{
    public function __invoke(Order $order): OrderResource
    {
        return new OrderResource($order->load('customer', 'items'));
    }
}
```

```php
// Bind by slug instead of id:
final class Project extends Model
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}

// Or per-route:
Route::get('/projects/{project:slug}', ProjectShowController::class);
```

Binding respects global scopes, so a tenant global scope makes cross-tenant URLs 404 automatically.

---

## Name the Route Parameter After the Bound Model

Implicit binding matches the route parameter name to the controller's type-hinted variable name, and scoped binding derives the parent relationship from the parameter name. A mismatch silently disables both — the controller receives the raw string, or an unscoped model.

Use the singular, camelCase model name: `{conversation}`, `{order}`, `{orderItem}`.

**Incorrect (three different names for one thing):**

```php
Route::get('/conversations/{id}/messages/{msg}', MessageShowController::class)->scopeBindings();

public function __invoke(Conversation $conversation, Message $message): MessageResource
// $conversation is not bound — the parameter is {id}.
// Scoping cannot find a `msg` relationship on Conversation.
```

**Correct:**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class)
    ->scopeBindings();

public function __invoke(Conversation $conversation, Message $message): MessageResource
```

```php
// Multi-word models use camelCase in the URI parameter:
Route::get('/orders/{order}/items/{orderItem}', OrderItemShowController::class)->scopeBindings();
```

If a URL segment must differ from the model name, bind explicitly rather than renaming the parameter: `Route::model('client', Customer::class)`.

---

## Scope Nested Bindings to Their Parent

`/conversations/{conversation}/messages/{message}` resolves both models independently by default. Nothing checks that the message belongs to the conversation — so any valid message ID works under any conversation URL.

Scoped binding resolves the child *through* the parent's relationship, making the hierarchy an enforced constraint.

**Incorrect (independent lookups; the URL lies):**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class);

// GET /conversations/1/messages/999 returns message 999 from conversation 42.
```

**Correct (explicit scoping):**

```php
Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class)
    ->scopeBindings();

// Or for a whole group:
Route::scopeBindings()->group(function (): void {
    Route::get('/conversations/{conversation}/messages/{message}', MessageShowController::class);
    Route::patch('/conversations/{conversation}/messages/{message}', MessageUpdateController::class);
});
```

Scoping is automatic when the child is bound by a custom key (`{message:uuid}`), and off otherwise — so state it explicitly rather than relying on which form you happened to write.

The child model must expose the relationship Laravel infers from the parameter name: `{message}` under `{conversation}` resolves via `Conversation::messages()`.

---

## Nest Only as Deep as the Parent Is Needed

Nest routes where the parent is required to identify or authorize the child: index and store. Once the child has its own unique identifier, the parent adds nothing — show, update and destroy can be shallow.

Two levels is the practical limit. `/merchants/{merchant}/orders/{order}/items/{item}/refunds/{refund}` serves nobody.

**Incorrect (nested all the way, so every link needs three IDs):**

```php
Route::get('/merchants/{merchant}/orders/{order}/items/{item}', ItemShowController::class);
Route::patch('/merchants/{merchant}/orders/{order}/items/{item}', ItemUpdateController::class);
Route::delete('/merchants/{merchant}/orders/{order}/items/{item}', ItemDestroyController::class);
```

**Correct (nested where the parent is needed, shallow after that):**

```php
// Parent required — it scopes the collection:
Route::get('/orders/{order}/items', ItemIndexController::class)->scopeBindings();
Route::post('/orders/{order}/items', ItemStoreController::class)->scopeBindings();

// Child is uniquely identified — authorize via policy instead:
Route::get('/items/{item}', ItemShowController::class);
Route::patch('/items/{item}', ItemUpdateController::class);
Route::delete('/items/{item}', ItemDestroyController::class);
```

Shallow routes shift the ownership check from the URL to the Policy, so the Policy must actually check it — see `rules/authz-policies-per-model.md`.

---

# 4. API Serialization

**Impact: HIGH**

JSON responses go through Resources. A raw Model in a response leaks whatever column someone adds next.

---

## Serialize Through a Resource, Never a Raw Model

Returning a Model or a Collection of Models makes the API contract equal to the table. Add a column and it appears in the response; rename one and every client breaks. `$hidden` helps but is a denylist — the next sensitive column is exposed by default.

Every JSON response goes through a `JsonResource` or `ResourceCollection`, which is an allow-list.

**Incorrect:**

```php
return response()->json($order);

return response()->json(Order::with('customer')->paginate(25));
```

**Correct:**

```php
final class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'total' => $this->total->minorUnits,
            'currency' => $this->total->currency,
            'placed_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

```php
return new OrderResource($order);

return OrderResource::collection($orders);   // keeps pagination meta and links
```

Returning the Resource directly from the controller is enough — Laravel converts it to a response.

---

## Use First-Party JSON:API Resources When the Spec Applies

Laravel 13 ships JSON:API resources, handling resource-object serialization, relationship inclusion, sparse fieldsets, links and the compliant response headers. If the API commits to JSON:API, use them rather than reimplementing `?include=` and `?fields[]=` parsing by hand.

Laravel 13 only. On Laravel 12, either use a plain `JsonResource` shape or a third-party package.

**Incorrect (hand-rolled include and sparse-fieldset handling):**

```php
public function toArray(Request $request): array
{
    $includes = explode(',', $request->string('include')->toString());
    $fields = explode(',', $request->string('fields.orders')->toString());

    $payload = ['id' => (string) $this->id, 'type' => 'orders', 'attributes' => []];
    // ... 60 lines reimplementing the spec, subtly wrong
}
```

**Correct (Laravel 13):**

```php
use Illuminate\Http\Resources\Json\JsonApiResource;

final class OrderResource extends JsonApiResource
{
    /** @return array<string, mixed> */
    public function toAttributes(Request $request): array
    {
        return [
            'number' => $this->number,
            'status' => $this->status->value,
            'placed_at' => $this->created_at->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function toRelationships(Request $request): array
    {
        return [
            'customer' => fn () => new CustomerResource($this->whenLoaded('customer')),
            'items' => fn () => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
```

Do not adopt JSON:API because it is available. Adopt it when clients want the spec — otherwise a plain Resource is simpler and `rules/resource-stable-payload-shape.md` still applies.

---

## Resources Live With Their Domain

A Resource is the domain's presentation contract, so it belongs in `app/Domain/<Context>/Resources/` next to the models and repositories it serializes — not in a global `app/Http/Resources/` bucket that every domain writes into.

Cross-domain output uses the consuming domain's own Resource over a DTO, never the producing domain's Model.

**Incorrect (one bucket, no boundaries, cross-domain imports invisible):**

```
app/Http/Resources/
    OrderResource.php
    CustomerResource.php
    UsageRecordResource.php
    ConversationResource.php
```

**Correct:**

```
app/Domain/Orders/Resources/
    OrderResource.php
    OrderItemResource.php
app/Domain/Billing/Resources/
    UsageRecordResource.php
app/Domain/Chat/Resources/
    ConversationResource.php
    MessageResource.php
```

```php
namespace App\Domain\Orders\Resources;

final class OrderResource extends JsonResource
{
    // ...
}
```

If two domains need the same output shape, that shape is a DTO in the Shared Kernel or a published contract — see the `laravel-skill:patterns` skill.

---

## Keep the Payload Shape Stable and Explicit

The Resource is the contract. Two habits keep it stable:

- Convert internal types to explicit wire types — enums to `->value`, dates to ISO 8601, money to an integer plus a currency. Never emit an object whose serialization is an implementation detail.
- Keep keys present with `null` rather than omitting them conditionally, unless absence is meaningful. A key that appears only sometimes forces every client to branch.

**Incorrect (enum object, mutable date format, keys that come and go):**

```php
return [
    'status' => $this->status,                   // serializes as {"value": "paid"} or "paid"?
    'placed_at' => $this->created_at,            // depends on $dateFormat
    'total' => $this->total,                     // a Money object
    ...($this->note ? ['note' => $this->note] : []),
];
```

**Correct:**

```php
return [
    'id' => $this->id,
    'status' => $this->status->value,
    'placed_at' => $this->created_at->toIso8601String(),
    'total' => ['amount' => $this->total->minorUnits, 'currency' => $this->total->currency],
    'note' => $this->note,                        // null, but always present
];
```

Additive changes (new keys) are safe. Renaming or removing a key is a breaking change and needs a new version of the endpoint, not an edit.

---

## Guard Relations With whenLoaded

A Resource that reads `$this->customer` lazy-loads it when the feeding query did not. That is an N+1 the Resource caused, and it appears wherever that Resource is reused.

`whenLoaded()` includes the relation only if it is already loaded, so the query decides the payload and the Resource cannot surprise it.

**Incorrect (one extra query per row, wherever this Resource is used):**

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'customer' => new CustomerResource($this->customer),
        'items' => ItemResource::collection($this->items),
        'item_count' => $this->items->count(),
    ];
}
```

**Correct:**

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'customer' => new CustomerResource($this->whenLoaded('customer')),
        'items' => ItemResource::collection($this->whenLoaded('items')),
        'item_count' => $this->whenCounted('items'),
        'total_paid' => $this->whenAggregated('payments', 'amount', 'sum'),
    ];
}
```

```php
// The query decides what the payload contains:
Order::query()->with(['customer', 'items'])->withCount('items')->paginate(25);
```

Combine with `Model::preventLazyLoading()` so a missing eager load throws in development rather than degrading in production.

---

# 5. Errors and Exceptions

**Impact: MEDIUM-HIGH**

Failures raise context-specific exception classes with named constructors, mapped to HTTP status once, centrally.

---

## Raise Context-Specific Exceptions, Never a Bare Exception

`throw new \Exception('Order already paid')` gives callers nothing to catch except everything, so handling it means matching on the message string — which breaks the moment the wording changes.

Domain exceptions live in `app/Domain/<Context>/Exceptions/`. Only genuinely app-wide exceptions go top level.

**Incorrect:**

```php
throw new \Exception('Subscriber already has a live subscription');

// Caller:
catch (\Exception $e) {
    if (str_contains($e->getMessage(), 'already has a live')) { /* ... */ }
}
```

**Correct:**

```php
namespace App\Domain\Billing\Exceptions;

use RuntimeException;

/**
 * Domain errors raised while moving a subscription through its lifecycle
 * (subscribe, switch, change plan).
 */
class SubscriptionException extends RuntimeException
{
    // named constructors — see rules/error-named-constructors.md
}
```

```php
catch (SubscriptionException $e) { /* one type, no string matching */ }
```

One exception class per lifecycle or concern, with a constructor per failure mode — not one class per failure.

---

## Map Exceptions to HTTP Status Once, Centrally

A domain exception should not know about HTTP — it is thrown by Actions that also run in queue workers and console commands. The translation to a status code belongs in the exception handler, applied once for every endpoint.

Configure it in `bootstrap/app.php` on Laravel 11+.

**Incorrect (status decided at every call site, inconsistently):**

```php
try {
    $action->handle($request->toDto());
} catch (SubscriptionException $e) {
    return response()->json(['error' => $e->getMessage()], 400);   // 400 here
}

// Another controller returns 422 for the same exception.
```

**Correct:**

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (SubscriptionException $e, Request $request) {
        return $request->expectsJson()
            ? response()->json(['message' => $e->getMessage()], 409)
            : back()->withErrors(['subscription' => $e->getMessage()]);
    });

    $exceptions->render(fn (StockException $e, Request $request) => response()->json([
        'message' => $e->getMessage(),
        'sku' => $e->sku,
    ], 422));
})
```

```php
// The controller stays clean:
return new OrderResource($action->handle($request->toDto()));
```

An exception may also implement `HttpExceptionInterface`, or declare `render()` and `report()` methods, when the mapping genuinely belongs to that one class.

---

## Give Each Failure Mode a Named Constructor

A static named constructor per failure mode puts the message in one place, forces the caller to supply the context the message needs, and makes the throw site read as a statement of what went wrong.

**Incorrect (message assembled at the throw site, differently each time):**

```php
throw new SubscriptionException("Subscriber {$user->id} already has a subscription");
// elsewhere:
throw new SubscriptionException('Already subscribed.');
```

**Correct:**

```php
class SubscriptionException extends RuntimeException
{
    /** subscribe() refuses to create a second live subscription. */
    public static function alreadySubscribed(Subscribable $subscriber): self
    {
        return new self(sprintf(
            'Subscriber (%s #%s) already has a live subscription. Use changePlan(), or cancel first.',
            $subscriber->getSubscriberType(),
            (string) $subscriber->getSubscriberKey(),
        ));
    }

    /** Proration is only meaningful within a single currency. */
    public static function cannotProrateAcrossCurrencies(
        Subscription $subscription,
        string $from,
        string $to,
    ): self {
        return new self(sprintf(
            'Cannot prorate plan change across currencies (%s → %s) for subscription %d; cancel and resubscribe.',
            $from,
            $to,
            $subscription->id,
        ));
    }
}
```

```php
throw SubscriptionException::alreadySubscribed($user);
```

Carry structured context as typed properties when the handler or the log needs it, not only inside the message string.

---

## Never Leak Internals in an Error Response

`APP_DEBUG=true` in production returns stack traces, file paths, environment variables and rendered SQL to whoever triggers the error. Even with debug off, echoing `$e->getMessage()` from an infrastructure exception can leak a connection string or a query.

Log the detail, return a stable message.

**Incorrect:**

```php
// .env in production
APP_DEBUG=true
```

```php
catch (\Throwable $e) {
    return response()->json(['error' => $e->getMessage()], 500);
    // "SQLSTATE[42S02]: Base table 'app_prod.orders_v2' doesn't exist ..."
}
```

**Correct:**

```php
// .env
APP_DEBUG=false
APP_ENV=production
```

```php
$exceptions->render(function (QueryException $e, Request $request) {
    report($e);   // full detail to the log

    return response()->json(['message' => 'Something went wrong. Please try again.'], 500);
});
```

```php
// Domain exceptions are written for users, so their message may be returned:
$exceptions->render(fn (StockException $e) => response()->json(['message' => $e->getMessage()], 422));
```

Scrub secrets from logs too: add `password`, `token`, `secret` and `authorization` to `$dontFlash`, and redact request bodies in your logging pipeline.

---

## Mark Secret Parameters With #[\SensitiveParameter]

PHP records every argument value in a stack trace. Any exception thrown below a function that received a password, token or API key carries that value into `getTraceAsString()`, `laravel.log`, the Ignition page and every frame uploaded to Sentry, Flare or Bugsnag. `APP_DEBUG=false` does not help: the leak is in the log and in a third party's UI, not in the response.

`#[\SensitiveParameter]` (PHP 8.2+) replaces the argument with `Object(SensitiveParameterValue)` wherever a trace is rendered. Apply it to plaintext passwords, API keys and bearer tokens, webhook signing secrets, encryption keys, connection strings, OTP codes, card numbers and national IDs.

It redacts traces only — not the exception *message* (never interpolate a secret into one), not values you log yourself, and not a secret serialized into a queued job payload (see the `laravel-skill:async` skill's `job-never-serialize-secrets`).

**Incorrect (the password is in the trace of every exception thrown below this call):**

```php
public function handle(string $email, string $password): User
{
    // ... throws InvalidCredentialsException on a bad password
}
```

```text
#3 AuthenticateUserAction->handle('ada@example.com', 'hunter2-real-password')
```

**Correct:**

```php
public function handle(string $email, #[\SensitiveParameter] string $password): User
```

```text
#3 AuthenticateUserAction->handle('ada@example.com', Object(SensitiveParameterValue))
```

```php
// Promoted constructor parameters take it too — this client would otherwise put
// its key in the trace of any downstream HTTP failure.
public function __construct(
    #[\SensitiveParameter] private string $apiKey,
    #[\SensitiveParameter] private string $webhookSecret,
    private string $baseUrl,
) {}
```

Pair it with the framework's own redaction: keep `password`, `token`, `secret` and `authorization` in the handler's `dontFlash`, and scrub request bodies in the logging pipeline. See `rules/error-never-leak-internals.md`.

Reference: [PHP RFC — Redacting parameters in back traces](https://wiki.php.net/rfc/redact_parameters_in_back_traces)

---

# 6. Controllers

**Impact: MEDIUM-HIGH**

A controller maps HTTP to the domain and back. It holds no business logic and constructs no queries.

---

## Declare Middleware and Authorization With Attributes

Laravel 13 adds `#[Middleware]` and `#[Authorize]` for controllers, so the requirement lives on the class or method it protects rather than in a route file someone edits separately.

Laravel 13 only. On Laravel 12, use `HasMiddleware::middleware()` or declare it on the route.

**Incorrect (protection declared far from the code it protects):**

```php
// routes/web.php — 400 lines away
Route::middleware(['auth', 'subscribed'])->group(function (): void {
    Route::post('/posts/{post}/comments', [CommentController::class, 'store']);
});
// Adding a method to the controller does not add protection.
```

**Correct (Laravel 13):**

```php
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
final class CommentController
{
    #[Middleware('subscribed')]
    #[Authorize('create', [Comment::class, 'post'])]
    public function store(Post $post, StoreCommentRequest $request): JsonResponse
    {
        // ...
    }
}
```

**Correct (Laravel 12):**

```php
final class CommentController implements HasMiddleware
{
    /** @return array<int, Middleware|string> */
    public static function middleware(): array
    {
        return ['auth', new Middleware('subscribed', only: ['store'])];
    }
}
```

Attributes complement Form Request `authorize()`; they do not replace it. Use whichever is closer to the decision, and use only one per endpoint so there is a single answer to "what guards this?".

---

## Prefer Single-Action Invokable Controllers

A resource controller with seven methods accumulates shared constructor dependencies that most methods do not use, and shared middleware that most methods do not need. An invokable controller per route keeps each endpoint's dependencies exact.

Resource controllers remain fine for genuine CRUD where all seven methods share the same model, policy and dependencies.

**Incorrect (dependencies injected for the two methods that need them):**

```php
final class OrderController extends Controller
{
    public function __construct(
        private PlaceOrderAction $place,
        private CancelOrderAction $cancel,
        private RefundOrderAction $refund,
        private OrderRepositoryInterface $orders,
        private ExportService $export,
    ) {}

    public function index() { /* uses $orders */ }
    public function store() { /* uses $place */ }
    // ... five more, each resolving all five dependencies
}
```

**Correct:**

```php
final class OrderIndexController
{
    public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): AnonymousResourceCollection
    {
        return OrderResource::collection($orders->searchOrders($request->toFilter()));
    }
}

final class OrderStoreController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($request->toDto())), 201);
    }
}
```

```php
Route::get('/orders', OrderIndexController::class)->name('orders.index');
Route::post('/orders', OrderStoreController::class)->name('orders.store');
```

---

## A Controller Constructs No Queries

`where()`, `orderBy()`, `with()` and `join()` do not appear in a controller. The controller builds Value Objects from the request and calls the Repository; the Query Class writes the clauses.

It holds however small the query looks — a lone `where()` with `paginate()`, a relation read off `$request->user()`, an optional `->when()` filter, a request-supplied page size, a `latest()` default. Same for a Blade view and a Form Request: a view receives data rather than fetching it, and `authorize()`/`rules()` never build a result set.

**Incorrect (filters built in the controller, duplicated in the export endpoint):**

```php
public function index(Request $request): View
{
    $orders = Order::query()
        ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
        ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')))
        ->with('customer')
        ->orderBy($request->input('sort', 'created_at'), $request->input('dir', 'desc'))
        ->paginate(25);

    return view('orders.index', compact('orders'));
}
```

**Incorrect (small enough to feel harmless — still four query rules at the edge):**

```php
final class ListNotificationsController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $notifications = $request->user()->notifications()
            ->when($request->boolean('unread'), fn (Builder $query): Builder => $query->whereNull('read_at'))
            ->latest()
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return NotificationResource::collection($notifications);
    }
}
```

**Correct:**

```php
public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): View
{
    return view('orders.index', [
        'orders' => $orders->searchOrders($request->toFilter(), perPage: 25),
    ]);
}
```

```php
// ...and the same shape for the second: one call, no clauses.
return NotificationResource::collection($notifications->feedFor($request->user(), $request->toFilter()));
```

The sort column is whitelisted and the page-size cap lives in the filter Value Object. See the `laravel-skill:patterns` skill for the full boundary.

---

## A Controller Maps HTTP and Delegates

A controller does four things: receive a validated request, convert it to a DTO, call an Action or a Repository, and shape the result into a response. Anything else — business rules, transactions, dispatching jobs, sending mail — belongs in the Action.

The measure: a controller method should be readable in one glance, usually three to five lines.

**Incorrect (the use case lives in the controller):**

```php
public function store(StoreOrderRequest $request): JsonResponse
{
    $order = DB::transaction(function () use ($request) {
        $order = Order::create($request->validated());
        foreach ($request->validated('items') as $item) {
            $order->items()->create($item);
            Product::where('sku', $item['sku'])->decrement('stock', $item['quantity']);
        }
        return $order;
    });

    Mail::to($order->customer)->send(new OrderConfirmation($order));
    UsageRecord::create(['tenant_id' => $order->tenant_id, 'amount' => $order->total]);

    return response()->json(new OrderResource($order), 201);
}
```

**Correct:**

```php
final class StoreOrderController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(
            new OrderResource($action->handle($request->toDto())),
            Response::HTTP_CREATED,
        );
    }
}
```

The Action now runs identically from the CSV importer and the test suite.

---
