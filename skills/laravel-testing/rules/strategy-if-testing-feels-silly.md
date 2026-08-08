---
title: If the Test Feels Silly, the Class Was Not Needed
impact: MEDIUM-HIGH
impactDescription: uses the test as the design signal it is
tags: strategy, design, simplicity, architecture
---

## If the Test Feels Silly, the Class Was Not Needed

Writing a test for a Query Class and finding there is nothing to assert beyond "it calls `find()`" means the class did not earn its existence. The same goes for a Service with one caller and no decision, or a Value Object wrapping one scalar.

The difficulty of writing a meaningful test is a design signal. Listen to it and delete the class.

**Incorrect (a test that restates the implementation):**

```php
it('finds an article by id', function (): void {
    $article = Article::factory()->create();

    expect((new FindArticleByIdQuery())->handle($article->id)->is($article))->toBeTrue();
});
// This tests Eloquent's find(). The query class should not exist.
```

**Correct (the query encodes rules worth asserting):**

```php
it('returns only pending orders older than the cutoff, oldest first', function (): void {
    $old = Order::factory()->pending()->create(['created_at' => now()->subHours(5)]);
    $newer = Order::factory()->pending()->create(['created_at' => now()->subHours(3)]);
    Order::factory()->pending()->create(['created_at' => now()->subMinutes(10)]);   // too recent
    Order::factory()->paid()->create(['created_at' => now()->subHours(5)]);         // wrong status

    $results = app(OrderRepositoryInterface::class)->abandonedSince(now()->subHours(2));

    expect($results->pluck('id')->all())->toBe([$old->id, $newer->id]);
});
```

The converse also holds: a class that is hard to test because it needs five collaborators and a database is usually doing more than one thing.
