## 1. Context and Contracts (context)

**Impact:** CRITICAL
**Description:** A change starts with the contract already in the repository: local instructions, callers, configuration, data shape and tests. Read enough of that path to know what must remain true before editing.

## 2. Design and Reuse (design)

**Impact:** HIGH
**Description:** Prefer the smallest readable implementation that reuses a present abstraction. A new seam, constant or layer must serve a consumer that exists today.

## 3. Correctness and Failure (correct)

**Impact:** CRITICAL
**Description:** Fix the condition that creates a failure, preserve errors, and make writes observable through the read shape their consumers use. Correctness comes from explicit guarantees, not incidental order or state.

## 4. Hygiene and Verification (hygiene)

**Impact:** HIGH
**Description:** Keep changed code and operational documentation current, remove dead code, and prove the risk-bearing path without adding framework or implementation-detail tests.
