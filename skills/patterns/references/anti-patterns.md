# Anti-Patterns — Flag and Refuse These

Each entry names the signal to grep for and the correct move.

| # | Anti-pattern | Signal | Do instead |
|---|--------------|--------|------------|
| 1 | **Generic `BaseRepository`** | `abstract class BaseRepository` with `find/all/create/update/delete` | Eloquent directly for simple models; a domain-specific interface only where the gate's Q5 applies |
| 2 | **A Service that is secretly a Repository** | a `*Service` whose body is only raw Eloquent | Make it a Repository, or inline it in the Action |
| 3 | **Repository interface too broad** | one interface with ~15 methods, most used once | Split into small focused interfaces |
| 4 | **Query Class with multiple public methods** | more than one public method on a `*Query` | One Query Class per public method; helpers stay `private` |
| 5 | **Query Class called from outside a Repository** | a Controller/Action/Service/Job/Command/Blade imports a `*Query` | Call the Repository interface |
| 6 | **Repository interface returning `Builder`** | `public function foo(): Builder` on a `*RepositoryInterface` | Return a domain type; `Builder` only from an internal Query Class |
| 7 | **Eloquent scattered across layers** | `Model::where(...)` copy-pasted for the same intent | One named query behind a Repository |
| 8 | **Wrapping trivial one-liners** | `Repo::find($id) { return Model::find($id); }` | Call Eloquent directly |
| 9 | **A layer "for consistency"** | a Service with one caller; a Repository whose every method is inline | Keep it in the Action / use Eloquent |
| 10 | **`Request` passed inward** | `handle(Request $request)`, or a repository method taking `Request` | Map to Value Objects in the Controller or Form Request |
| 11 | **Long parameter list** | any method with more than 4 params, or related params not grouped | Group into Value Objects |
| 12 | **Greedy Value Object** | a class wrapping one unrelated scalar; a DTO for a 1–2 param query; a domain object buried in a filter | Keep scalars scalar; pass domain objects directly |
| 13 | **Value Object that builds queries** | a `DateRange`/`Sorting`/`*Filter` importing `Builder`, or an `apply(Builder)` method | Keep it pure; write the clause in the Query Class |
| 14 | **Date-range `where` duplicated across Query Classes** | the same `>=`/`<=` pair in several queries | A `private` helper per Query Class, or compose Query Classes — never `apply()` on the VO |
| 15 | **Trusting a user-supplied sort column** | `orderBy($request->string('sort'))` with no allow-list | Whitelist sortable columns in the Query Class |
| 16 | **`env()` outside `config/`** | `env(` in `app/`, `routes/`, `database/` | Read `config()`; `config:cache` makes `env()` return null |
| 17 | **Cross-domain Model import** | `use App\Domain\<Other>\Models\…` | Domain Event, or an Open Host Service returning DTOs |
| 18 | **Top-level layer folders** | `app/Services/`, `app/Repositories/`, `app/Queries/` | Domain-first layout under `app/Domain/<Context>/` |
| 19 | **Contract with no implementation** | an interface in `Contracts/` with an empty `Repositories/`, or no `bind()` for it | Ship interface, implementation and binding in one change |
| 20 | **Pass-through Action** | a `handle()` whose whole body is `return $this->x->y(...$args);` | Delete it; the entry point calls the collaborator |
| 21 | **List query at the edge** | `paginate(` or `->latest()` in a Controller, Form Request, Resource or Blade view | A named Repository method with a Query Class behind it |
| 22 | **One concept, two homes** | the same class name under two domains, or a shared domain importing another domain's Models | Shared module owns the mechanism; each domain owns its own messages |
| 23 | **Secret as a plain parameter** | a password, key or token parameter with no `#[\SensitiveParameter]`, or one passed to a queued job's constructor | Mark the parameter; pass an identifier to jobs and resolve the secret in `handle()` |
