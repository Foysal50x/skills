---
title: Never Fetch a URL the Client Chose
impact: CRITICAL
impactDescription: closes the request-forgery path into the internal network
tags: http-client, ssrf, security, validation, integration
---

## Never Fetch a URL the Client Chose

A webhook target, an "import from URL" field, an avatar the API fetches on the user's behalf — each hands an attacker your server's network position. `http://169.254.169.254/` reads cloud credentials; `http://localhost:9200/` reads the search index; a redirect turns a URL that validated cleanly into one that did not.

`url` validation does not help: the address is well-formed, it is simply not yours to reach.

**Incorrect (validated, and still a request into the private network):**

```php
$data = $request->validate(['source' => ['required', 'url']]);

$body = Http::timeout(5)->get($data['source'])->body();   // 169.254.169.254 passes 'url'
```

**Correct (the client names a destination, the server decides the address):**

```php
final class ImportSourceUrl
{
    private const ALLOWED_HOSTS = ['exports.partner.test', 'cdn.partner.test'];

    public static function from(string $candidate): self
    {
        $parts = parse_url($candidate);

        if (($parts['scheme'] ?? null) !== 'https' || ! in_array($parts['host'] ?? '', self::ALLOWED_HOSTS, true)) {
            throw ImportRejected::untrustedSource($candidate);
        }

        return new self($candidate);
    }
}
```

```php
$body = Http::timeout(5)
    ->withoutRedirecting()     // a 302 must not move the request off the allowlist
    ->get(ImportSourceUrl::from($data['source'])->value)
    ->throw()
    ->body();
```

An allowlist of hosts beats a denylist of addresses — private ranges are larger than the list you will write, and DNS can point a permitted name at one of them. Where the destination is genuinely open-ended, resolve the host yourself, reject private and link-local addresses, and send the request through an egress proxy that enforces the same rule.

Outbound calls still need `rules/client-explicit-timeouts.md` and `rules/client-handle-status-explicitly.md`.
