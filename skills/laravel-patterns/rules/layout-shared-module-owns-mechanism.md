---
title: A Shared Module Owns the Mechanism, Not Other Domains' Messages
impact: MEDIUM-HIGH
impactDescription: stops one concept growing two homes
tags: layout, domains, notifications, ownership, bounded-context
---

## A Shared Module Owns the Mechanism, Not Other Domains' Messages

When a cross-cutting concern gets its own domain — Notification, Reporting, Search, Export — draw the line once: **the shared domain owns the mechanism, each business domain owns the content describing its own data.**

The test is what the class reads. `TodoCompletedNotification` reads a Todo's title and completion time, so it belongs to `Domain/Todo/Notifications/`. Preferences, channel routing, the unread feed and its endpoints belong to `Domain/Notification/`. Placed on the wrong side, a class either imports another domain's Models (see `rules/domain-no-cross-domain-models.md`) or splits one concept so every change touches both folders.

If the shared domain would hold nothing but other domains' messages, do not create it.

**Incorrect (the shared domain reaches into Todo, and Todo keeps a copy anyway):**

```text
app/Domain/Notification/Notifications/
  TodoCompletedNotification.php   # use App\Domain\Todo\Models\Todo;  ← cross-domain import
  InvoicePaidNotification.php     # use App\Domain\Billing\Models\Invoice;
app/Domain/Todo/Notifications/
  TodoCompletedNotification.php   # same idea, second home
```

Renaming a Todo column now breaks a class in another bounded context, and nobody can say where the next notification goes.

**Correct (mechanism on one side, messages on the other):**

```text
app/Domain/Notification/          the mechanism
  Contracts/NotificationPreferences.php
  Http/Controllers/ListNotificationsController.php
  Repositories/EloquentNotificationRepository.php
  Resources/NotificationResource.php
  Channels/PushChannel.php

app/Domain/Todo/                  the message, next to the data it describes
  Notifications/TodoCompletedNotification.php
  Events/TodoCompleted.php
```

```php
namespace App\Domain\Todo\Notifications;

// The message reaches the mechanism through its published contract:
public function via(NotificationPreferences $notifiable): array
{
    return $notifiable->channelsFor('todo.completed');
}
```

Todo depends on the Notification domain's contract, never the reverse. Same split for Reporting (owns scheduling and rendering, not each domain's report definitions) and Export (owns the writer, not the row mappers).
