---
title: A Shared Module Owns the Mechanism, Not Other Domains' Messages
impact: MEDIUM-HIGH
impactDescription: stops one concept growing two homes
tags: layout, domains, notifications, ownership, bounded-context
---

## A Shared Module Owns the Mechanism, Not Other Domains' Messages

When a cross-cutting concern gets its own domain — Notifications, Reporting, Search, Export — draw the line once: **the shared domain owns the mechanism, each business domain owns the content that describes its own data.**

The test is what the class reads. `TodoCompletedNotification` reads a Todo's title and completion time and changes whenever Todo does, so it belongs to `Domain/Todo/Notifications/`. Delivery preferences, channel routing, the unread feed and its endpoints belong to `Domain/Notification/`. A class placed on the wrong side either imports another domain's Models (forbidden — see `rules/domain-no-cross-domain-models.md`) or splits one concept across two folders so every change touches both.

If the shared domain would contain nothing but other domains' messages, do not create it. Put the classes in their domains and stop.

**Incorrect (the shared domain reaches into Todo, and Todo keeps a copy of the concept anyway):**

```text
app/Domain/Notification/
  Notifications/
    TodoCompletedNotification.php   # use App\Domain\Todo\Models\Todo;  ← cross-domain import
    InvoicePaidNotification.php     # use App\Domain\Billing\Models\Invoice;
app/Domain/Todo/
  Notifications/
    TodoCompletedNotification.php   # same idea, second home
```

Renaming a Todo column now breaks a class in another bounded context, and nobody can say where the next notification goes.

**Correct (mechanism on one side, messages on the other):**

```text
app/Domain/Notification/           the mechanism
  Contracts/
    NotificationPreferences.php
  Http/Controllers/
    ListNotificationsController.php
    MarkNotificationReadController.php
  Repositories/
    EloquentNotificationRepository.php
  Resources/
    NotificationResource.php
  Channels/
    PushChannel.php

app/Domain/Todo/                   the message, next to the data it describes
  Notifications/
    TodoCompletedNotification.php
  Events/
    TodoCompleted.php
```

```php
namespace App\Domain\Todo\Notifications;

/**
 * Database-only payload. Dispatched from an already-queued listener, so it
 * deliberately does not implement ShouldQueue itself.
 */
final class TodoCompletedNotification extends Notification
{
    public function __construct(
        private readonly int $todoId,
        private readonly string $title,
        private readonly CarbonImmutable $completedAt,
    ) {}

    /** @return list<string> */
    public function via(NotificationPreferences $notifiable): array
    {
        return $notifiable->channelsFor('todo.completed');   // contract published by Domain/Notification
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'todo_id' => $this->todoId,
            'title' => $this->title,
            'completed_at' => $this->completedAt->toIso8601String(),
        ];
    }
}
```

Todo depends on the Notification domain's published contract, never the reverse. The same split applies to Reporting (owns scheduling and rendering, not each domain's report definitions) and Export (owns the writer and the download, not each domain's row mapper).
