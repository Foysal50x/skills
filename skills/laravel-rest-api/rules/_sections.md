# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Authorization (authz)

**Impact:** CRITICAL
**Description:** Every request that reads or writes tenant-scoped data is authorized before the domain runs. An ID in a request body is a claim, not a fact.

## 2. Form Requests and Validation (request)

**Impact:** HIGH
**Description:** Validation lives in Form Requests, which also carry authorization and produce the DTO the domain consumes. HTTP stops there.

## 3. Routing and Model Binding (route)

**Impact:** HIGH
**Description:** Route model binding removes lookup boilerplate — and scoped binding turns a nested URL into an enforced parent-child relationship instead of a suggestion.

## 4. API Serialization (resource)

**Impact:** HIGH
**Description:** JSON responses go through Resources. A raw Model in a response leaks whatever column someone adds next.

## 5. Errors and Exceptions (error)

**Impact:** MEDIUM-HIGH
**Description:** Failures raise context-specific exception classes with named constructors, mapped to HTTP status once, centrally.

## 6. Controllers (controller)

**Impact:** MEDIUM-HIGH
**Description:** A controller maps HTTP to the domain and back. It holds no business logic and constructs no queries.

## 7. Outbound HTTP (client)

**Impact:** MEDIUM-HIGH
**Description:** Calls leaving the application need the same discipline as calls arriving: an explicit timeout, a retry policy that cannot amplify an outage, a decision per status code, and no request in a test that reaches the network.
