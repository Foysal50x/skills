---
title: Restart Workers on Every Deploy
impact: HIGH
impactDescription: stops workers running last release's code indefinitely
tags: queues, deployment, workers, operations
---

## Restart Workers on Every Deploy

A queue worker boots the framework once and keeps it in memory. New code deployed to disk is not picked up — the worker keeps running the old classes until it restarts, which may be never.

`php artisan queue:restart` signals every worker to exit gracefully after its current job; the process supervisor starts a fresh one.

**Incorrect (deploy script that never touches the workers):**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
# workers still running the previous release
```

**Correct:**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache

php artisan queue:restart      # after the new code and caches are in place
# Horizon: php artisan horizon:terminate
```

Two supporting habits:

- Set `--max-time` or `--max-jobs` on workers so they recycle even if a restart signal is missed.
- Keep a migration backwards-compatible for one release, since in-flight jobs from the old code run against the new schema.
