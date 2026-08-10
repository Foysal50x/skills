---
title: Keep the Payload Shape Stable and Explicit
impact: MEDIUM-HIGH
impactDescription: clients stop breaking on internal changes
tags: resources, api-design, versioning, contracts
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
