---
title: Normalize Input in prepareForValidation
impact: MEDIUM-HIGH
impactDescription: rules validate the canonical value, not the raw one
tags: validation, normalization, form-request
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
