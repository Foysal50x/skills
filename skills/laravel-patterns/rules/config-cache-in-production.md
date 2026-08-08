---
title: Cache Config, Routes and Events in Production
impact: MEDIUM
impactDescription: removes per-request filesystem and reflection work
tags: config, production, deployment, performance
---

## Cache Config, Routes and Events in Production

Production deploys run the caching commands after installing dependencies. Skipping them costs a measurable amount of work on every request; running them without the discipline in `rules/config-never-env-outside-config.md` breaks the app.

Caches are build artefacts: rebuild on deploy, never commit them.

**Incorrect (deploy script that only migrates):**

```bash
composer install --no-dev
php artisan migrate --force
php artisan queue:restart
```

**Correct:**

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force

php artisan config:cache
php artisan route:cache      # requires no closure-based routes
php artisan event:cache
php artisan view:cache
# or, all of the above:
# php artisan optimize

php artisan queue:restart    # workers must reload the new code
```

Two consequences to respect:

- `route:cache` fails on closure routes — every route must point at a controller class.
- Long-lived workers keep the old code in memory until `queue:restart`, so it belongs in every deploy.

Clear caches in local development with `php artisan optimize:clear`.
