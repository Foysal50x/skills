# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Jobs (job)

**Impact:** CRITICAL
**Description:** A queued job runs more than once. Design every handler so that running it twice produces the same result as running it once, and so a failure is retried rather than lost.

## 2. Domain Events (event)

**Impact:** HIGH
**Description:** Side effects are announced, not performed inline. The producer dispatches a past-tense event carrying identities; each consumer reacts in its own domain.

## 3. Queue Operations (queue)

**Impact:** HIGH
**Description:** Queues need separation by priority, a plan for failures, and workers that actually restart on deploy. The defaults are for development.

## 4. Caching (cache)

**Impact:** HIGH
**Description:** Cache read-heavy work, key it deterministically, and invalidate it where the data changes — not on a timer you hope is short enough.

## 5. Scheduling (schedule)

**Impact:** MEDIUM
**Description:** Scheduled tasks queue work rather than doing it, never overlap, and run on exactly one server.
