---
title: One Use Case Means One Action
impact: HIGH
impactDescription: keeps entry points thin and testable
tags: gate, action, orchestration
---

## One Use Case Means One Action

Q1 of the Decision Gate. If the logic runs a single use case from entry to result — validate intent, coordinate collaborators, produce an outcome — it is an Action. Controllers, jobs and console commands are entry points, not homes for logic.

**Incorrect (use case spread across the controller):**

```php
final class SubmitPromptController
{
    public function __invoke(SubmitPromptRequest $request): JsonResponse
    {
        $conversation = Conversation::findOrFail($request->integer('conversation_id'));
        $provider = $conversation->tenant->plan === 'pro' ? new OpenAi() : new Ollama();
        $history = $conversation->messages()->latest()->take(20)->get();
        $answer = $provider->complete($history, $request->string('prompt'));
        $conversation->messages()->create(['role' => 'assistant', 'content' => $answer]);
        UsageRecord::create(['tenant_id' => $conversation->tenant_id, 'tokens' => $answer->tokens]);

        return response()->json(['answer' => $answer]);
    }
}
```

**Correct (controller maps HTTP, Action owns the use case):**

```php
final class SubmitPromptController
{
    public function __invoke(SubmitPromptRequest $request, SubmitPromptAction $action): JsonResponse
    {
        return response()->json(
            new MessageResource($action->handle($request->toDto())),
        );
    }
}

// app/Domain/Chat/Actions/SubmitPromptAction.php
final readonly class SubmitPromptAction
{
    public function __construct(
        private ChatRepositoryInterface $chat,
        private AiProviderRouterService $providers,
    ) {}

    public function handle(SubmitPromptData $data): Message
    {
        // one use case, end to end
    }
}
```

See `rules/action-naming-verb-noun.md` for naming.
