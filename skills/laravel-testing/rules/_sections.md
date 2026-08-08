# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Strategy by Layer (strategy)

**Impact:** HIGH
**Description:** Each architectural layer has one test style that fits it. Testing an Action against a real database, or a Query Class against a mock, produces slow suites that prove little.

## 2. Fakes and Doubles (fake)

**Impact:** HIGH
**Description:** Fake the boundary, not the framework. A hand-written fake implementing your own interface beats a mock of Eloquent every time.

## 3. Database Tests (db)

**Impact:** HIGH
**Description:** Query Classes and Repositories are tested against a real database with factories. Test your query rules — which rows are in, which are out, in what order — not Eloquent itself.

## 4. Feature Tests (http)

**Impact:** MEDIUM-HIGH
**Description:** Feature tests cover the edge: status codes, payload shape, authorization, and the query count of hot endpoints.

## 5. Value Object Tests (vo)

**Impact:** MEDIUM
**Description:** Value Objects are pure, so their tests are pure — no database, no container, no Builder.
