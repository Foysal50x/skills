---
title: Wrap External Upstreams in an Anti-Corruption Layer
impact: HIGH
impactDescription: an upstream schema change touches one translator
tags: ddd, acl, adapter, infrastructure
---

## Wrap External Upstreams in an Anti-Corruption Layer

When a domain consumes something it does not control — a third-party API, a legacy system, another team's unstable service — wrap it in a Translator or Adapter that converts the upstream model into your domain's own model.

Place it in the consumer's `Domain/<Context>/ACL/`, or in `app/Infrastructure/` when several domains share the adapter.

**Incorrect (the vendor's payload shape spreads through the domain):**

```php
final readonly class SubmitPromptAction
{
    public function handle(SubmitPromptData $data): Message
    {
        $response = Http::post('https://api.provider.test/v1/chat', [...])->json();

        return Message::create([
            'content' => $response['choices'][0]['message']['content'],   // vendor shape
            'tokens' => $response['usage']['total_tokens'],
        ]);
    }
}
```

**Correct (one translator owns the vendor's shape):**

```php
// app/Infrastructure/AiProvider/AiProviderInterface.php
interface AiProviderInterface
{
    public function complete(PromptContext $context): Completion;   // domain types
}

// app/Infrastructure/AiProvider/OpenAiProvider.php
final readonly class OpenAiProvider implements AiProviderInterface
{
    public function complete(PromptContext $context): Completion
    {
        $response = $this->http
            ->timeout(20)
            ->post('/v1/chat/completions', $this->toPayload($context));

        if ($response->failed()) {
            throw AiProviderUnavailable::from($response->status());   // domain exception
        }

        return new Completion(
            content: $response->json('choices.0.message.content'),
            tokens: $response->json('usage.total_tokens'),
        );
    }
}
```

The domain now depends on `Completion`. Swapping providers, or absorbing a breaking upstream change, edits one class. The translation is not only of the happy path: the adapter is also where the upstream's timeouts and status codes become the domain's own exception type, so no `RequestException` reaches a use case.
