# Test Coverage Reference

A detailed, per-suite and per-case breakdown of the automated tests for the
Liquid Barcodes Agent API Cognigy extension — **what** each test verifies and
**how** it does it.

- **Test runner:** Jest 29 + `ts-jest` (config in [jest.config.js](../jest.config.js))
- **HTTP mocking:** [`axios-mock-adapter`](https://www.npmjs.com/package/axios-mock-adapter)
- **Test location:** [src/\_\_tests\_\_/](../src/__tests__/)
- **Totals:** 19 unit suites · **193 unit tests** · +1 env-gated integration suite (**24 tests**) = **217 total**

## How to run

| Command | What it does |
|---|---|
| `npm test` | Runs every suite (incl. the live-sandbox `integration.test.ts` when `.env` credentials are present). |
| `npm run test:coverage` | Same, with coverage collection. |
| `npm run test:coverage:detailed` | **Recommended for reviewing coverage.** Unit tests only (excludes live integration), `--verbose` prints every test name plus the per-file coverage table. |
| `npm run test:ci` | Unit tests + coverage + threshold enforcement (for CI). |

## Coverage snapshot (unit suites)

| Metric | Result |
|---|---|
| Statements | 100% (253/253) |
| Lines | 100% (253/253) |
| Functions | 100% (17/17) |
| Branches | 73.91% (51/69) |

Enforced minimums live in [jest.config.js](../jest.config.js) (`coverageThreshold`).
The remaining branch gaps are defensive `?? ''` / `?? null` fallbacks — see
[Known coverage gaps](#known-coverage-gaps).

---

## Table of contents

- [Shared test mechanics (how the tests work)](#shared-test-mechanics-how-the-tests-work)
- [Utility suites](#utility-suites)
  - [signature.test.ts](#signaturetestts)
  - [httpClient.test.ts](#httpclienttestts)
  - [extractApiError.test.ts](#extractapierrortestts)
- [Structure suite](#structure-suite)
  - [extension.test.ts](#extensiontestts)
- [Authentication node suites](#authentication-node-suites)
  - [requestSsoToken.test.ts](#requestssotokentestts)
  - [authSso.test.ts](#authssotestts)
  - [authOtpStart.test.ts](#authotpstarttestts)
  - [authOtpVerify.test.ts](#authotpverifytestts)
- [Data-read node suites](#data-read-node-suites)
  - [getUser.test.ts](#getusertestts)
  - [getStores.test.ts](#getstorestestts)
  - [getStoresMachinesStatus.test.ts](#getstoresmachinesstatustestts)
  - [getReceipts.test.ts](#getreceiptstestts)
  - [getSubscriptionUsers.test.ts](#getsubscriptionuserstestts)
- [Write node suites](#write-node-suites)
  - [cancelSubscription.test.ts](#cancelsubscriptiontestts)
  - [addSubscriptionUser.test.ts](#addsubscriptionusertestts)
  - [removeSubscriptionUser.test.ts](#removesubscriptionusertestts)
  - [setPlateNumber.test.ts](#setplatenumbertestts)
  - [issueCoupon.test.ts](#issuecoupontestts)
- [Cross-cutting security suite](#cross-cutting-security-suite)
  - [security.test.ts](#securitytestts)
- [Live integration suite](#live-integration-suite)
  - [integration.test.ts](#integrationtestts)
- [Known coverage gaps](#known-coverage-gaps)

---

## Shared test mechanics (how the tests work)

Almost every node suite is built from the same reusable parts, defined in
[src/\_\_tests\_\_/helpers.ts](../src/__tests__/helpers.ts). Understanding these five
mechanics explains "how the test is done" for the whole node suite.

1. **Mock Cognigy runtime — `createMockParams(config)`**
   Builds a fake `INodeFunctionBaseParams` with a stubbed `cognigy.api`. The two
   methods the nodes use are jest mocks that record into in-memory stores:
   - `api.addToContext(key, value, mode)` → writes to a `contextStore` object.
   - `api.log(level, message)` → pushes to a `logs` array.
   Tests then assert against `contextStore[...]` (what the node saved) and `logs`
   (what it logged). `getNodeFunction(node)` extracts the node's `function` to call.

2. **HTTP interception — `axios-mock-adapter`**
   Each suite creates `new MockAdapter(axios)` in `beforeEach` and calls
   `mock.restore()` in `afterEach`. Endpoints are stubbed with
   `mock.onPost/onGet/onPut/onDelete(url).reply(status, body)`. The actual outgoing
   request is inspected via `mock.history.<method>[0]` — its `.headers`, `.data`
   (raw JSON string), `.params` (query), and `.url`.

3. **Deterministic signatures**
   The signature includes an ISO timestamp, so to assert an exact value the tests
   pin time with `jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime)`,
   independently recompute the expected SHA-256 with Node's `crypto`, and assert the
   request's `X-Liquid-Signature` header equals it. `jest.restoreAllMocks()` runs in
   `afterEach`.

4. **Shared fixture — `TEST_CONNECTION`**
   A canonical connection object (`baseUrl`, `apiKey`, `signatureSalt`, `appBaseUrl`,
   `appSecretKey`) reused across suites so URLs and secrets are consistent.

5. **Error simulation**
   Error paths use `.reply(4xx/5xx, problemDetailsBody)` or `.networkError()`, and the
   test asserts the node stored `{ error: ... }` in context and logged at `error` level.

The standard per-node "recipe" (what each node suite checks): **(a)** correct HTTP
method + URL/path, **(b)** request body/query params, **(c)** exact signature field
order, **(d)** auth headers (`X-Customer-Api-Key`, and `Authorization: Bearer` where
applicable), **(e)** the success result written to context, **(f)** graceful error
handling.

---

## Utility suites

### signature.test.ts

- **Target:** [src/utils/signature.ts](../src/utils/signature.ts) — `computeSignature(timestamp, fields, salt)`
- **Suite:** `computeSignature` · **15 tests**
- **How:** Pure-function tests. Each recomputes the expected SHA-256 with Node's
  `crypto` and compares, or checks format via regex.

| # | Test | What it verifies |
|---|---|---|
| 1 | produces lowercase hex SHA-256 | Output matches `/^[0-9a-f]{64}$/`. |
| 2 | matches manual SHA-256 computation | `timestamp + salt` (no fields) equals a hand-computed hash. |
| 3 | concatenates fields in order between timestamp and salt | Order is `timestamp + fieldA + fieldB + salt`. |
| 4 | omits null/undefined/empty fields | `null`, `undefined`, `''` are skipped in concatenation. |
| 5 | trims all parts | Leading/trailing whitespace on timestamp, fields, and salt is trimmed. |
| 6 | handles unicode/emoji fields | Emoji + accented chars hash correctly (UTF-8). |
| 7 | different salts produce different signatures | Salt actually affects the digest. |
| 8 | SSO: timestamp + ssoToken + salt | Per-endpoint field order for `/v1/auth/sso`. |
| 9 | OTP start: timestamp + phone + salt | Field order for `/v1/auth/otp/start`. |
| 10 | OTP verify: timestamp + phone + code + salt | Field order for `/v1/auth/otp/verify`. |
| 11 | Get user: timestamp + salt (no fields) | No extra fields for `/v1/user`. |
| 12 | Get stores with storeId | `storeId` included when present. |
| 13 | Get stores without storeId | `storeId` omitted when empty. |
| 14 | Get receipts with both filters | `storeId + dateFrom` order. |
| 15 | Get receipts with only dateFrom | Absent `storeId` omitted; only `dateFrom` included. |

### httpClient.test.ts

- **Target:** [src/utils/httpClient.ts](../src/utils/httpClient.ts) — `makeAgentApiRequest(...)`
- **Suite:** `makeAgentApiRequest` · **9 tests**
- **How:** Uses `axios-mock-adapter`; inspects `mock.history` for headers/params and the returned value.

| # | Test | What it verifies |
|---|---|---|
| 1 | sends X-Customer-Api-Key header | API key placed in `X-Customer-Api-Key`. |
| 2 | sends X-Liquid-Timestamp as ISO 8601 | Timestamp header matches ISO date pattern. |
| 3 | sends X-Liquid-Signature as 64-char lowercase hex | Signature header format. |
| 4 | adds Authorization Bearer header when accessToken is provided | `Authorization: Bearer <token>` present. |
| 5 | does NOT send Authorization header when accessToken is omitted | No `Authorization` when token absent. |
| 6 | sets Content-Type for POST requests | `application/json` on body requests. |
| 7 | appends query params for GET requests | `queryParams` forwarded to `request.params`. |
| 8 | returns data and status | Resolves `{ data, status }` from the response. |
| 9 | throws on error response | Rejects on a 401 problem-details response. |

### extractApiError.test.ts

- **Target:** [src/utils/extractApiError.ts](../src/utils/extractApiError.ts) — `extractApiError(error)`
- **Suite:** `extractApiError` (4 nested describes) · **10 tests**
- **How:** Pure-function tests feeding synthetic error shapes and asserting the normalized `{ message, code?, status?, traceId? }`. Covers all four branches (this suite closed the previously-untested file).

| Branch | Test | What it verifies |
|---|---|---|
| RFC problem-details (`code` + `detail`) | maps detail/code/status/traceId | Full mapping when all fields present. |
| | leaves status/traceId undefined when absent | Missing optional fields → `undefined`. |
| | falls through when only code is present (no detail) | Without `detail`, drops to the HTTP-status branch (`HTTP 500: ...`). |
| title-only | maps title/status/traceId when code+detail absent | Uses `data.title` as the message. |
| | title takes precedence over the HTTP-status fallback | `title` chosen before status formatting. |
| HTTP-status fallback | formats "HTTP {status}: {message}" when data has no code/detail/title | Empty `data` → status-based message. |
| | applies when response has a status but no data at all | No `data` object → status-based message. |
| bare fallback | uses error.message when there is no response | Plain `Error` → its message. |
| | returns "Unknown error" when no message is available | `{}` → `'Unknown error'`. |
| | returns "Unknown error" for null/undefined input | `null`/`undefined` handled safely. |

---

## Structure suite

### extension.test.ts

- **Target:** All 14 node definitions + [src/connections/agentApiConnection.ts](../src/connections/agentApiConnection.ts)
- **Suite:** `Extension structure` · **10 tests**
- **How:** Imports every node object and the connection, then asserts on their static
  metadata (no HTTP, no execution). Guards against mis-wired node/connection config.

| # | Test | What it verifies |
|---|---|---|
| 1 | all 14 nodes are defined | The node list has exactly 14 entries. |
| 2 | all nodes have unique types | No duplicate `type` identifiers. |
| 3 | all nodes have a defaultLabel | Every node has a display label. |
| 4 | all nodes have a function | Every node exposes an executable `function`. |
| 5 | all nodes have fields | Every node declares config fields. |
| 6 | all nodes have sections | Every node declares form sections. |
| 7 | all nodes reference the correct connection type | Connection field points to `liquid-barcodes-agent-api`. |
| 8 | all section field refs match actual field keys | Every section's field reference resolves to a real field key. |
| 9 | connection schema has 5 fields | `baseUrl`, `apiKey`, `signatureSalt`, `appBaseUrl`, `appSecretKey`. |
| 10 | connection type is liquid-barcodes-agent-api | Connection `type` string is correct. |

---

## Authentication node suites

### requestSsoToken.test.ts

- **Target:** [src/nodes/requestSsoToken.ts](../src/nodes/requestSsoToken.ts) — POST `{appBaseUrl}/auth/lb/tokens` (App API)
- **Suite:** `requestSsoToken node (POST /auth/lb/tokens)` · **9 tests**
- **Notable:** This is the only node calling the **App API** — it signs with
  `appSecretKey` and sends **no** `X-Customer-Api-Key` and **no** `Authorization`.

| # | Test | What / how |
|---|---|---|
| 1 | calls POST with UserId body | Body `{ UserId }` parsed from `mock.history.post[0].data`. |
| 2 | signature = SHA256(timestamp + userId + appSecretKey) | Time pinned; signature recomputed with `appSecretKey`. |
| 3 | stores token and expirationDate in context | `contextStore[key]` = `{ token, expirationDate }`. |
| 4 | does NOT send X-Customer-Api-Key header | App API must not receive the customer key. |
| 5 | does NOT send Authorization header | No bearer token on this call. |
| 6 | sends X-Liquid-Timestamp and X-Liquid-Signature headers | Both signature headers present and well-formed. |
| 7 | handles App API error (ResponseStatus format) | ServiceStack-style `{ ResponseStatus }` mapped to `error.message`/`error.code`. |
| 8 | handles network error | `.networkError()` → error stored + logged. |
| 9 | logs error on failure | 500 response produces an `error`-level log. |

### authSso.test.ts

- **Target:** [src/nodes/authSso.ts](../src/nodes/authSso.ts) — POST `/v1/auth/sso`
- **Suite:** `authSso node (POST /v1/auth/sso)` · **7 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST /v1/auth/sso with ssoToken body | Body `{ ssoToken }`. |
| 2 | signature = SHA256(timestamp + ssoToken + salt) | Exact signature (time pinned). |
| 3 | stores accessToken and expiresInSeconds in context | `{ accessToken, expiresInSeconds }`. |
| 4 | sends X-Customer-Api-Key header | Customer key present (Agent API). |
| 5 | does NOT send Authorization header | No bearer on the exchange call. |
| 6 | handles API error and stores error in context | 401 problem-details → `error.code === 'INVALID_SIGNATURE'`. |
| 7 | logs error on failure | 400 response → `error`-level log recorded. |

### authOtpStart.test.ts

- **Target:** [src/nodes/authOtpStart.ts](../src/nodes/authOtpStart.ts) — POST `/v1/auth/otp/start`
- **Suite:** `authOtpStart node (POST /v1/auth/otp/start)` · **5 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST with phone body | Body `{ phone }`. |
| 2 | signature = SHA256(timestamp + phone + salt) | Exact signature. |
| 3 | stores phone response in context | `{ phone }` saved. |
| 4 | does NOT send Authorization header | Pre-auth call, no bearer. |
| 5 | handles API error | 400 → `error` stored in context. |

### authOtpVerify.test.ts

- **Target:** [src/nodes/authOtpVerify.ts](../src/nodes/authOtpVerify.ts) — POST `/v1/auth/otp/verify`
- **Suite:** `authOtpVerify node (POST /v1/auth/otp/verify)` · **5 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST with phone and code | Body `{ phone, code }`. |
| 2 | signature = SHA256(timestamp + phone + code + salt) | Exact signature with both fields. |
| 3 | stores accessToken and expiresInSeconds in context | `{ accessToken, expiresInSeconds }`. |
| 4 | does NOT send Authorization header | Pre-auth call. |
| 5 | handles API error | 401 → `error.code === 'INVALID_SIGNATURE'`. |

---

## Data-read node suites

### getUser.test.ts

- **Target:** [src/nodes/getUser.ts](../src/nodes/getUser.ts) — GET `/v1/user`
- **Suite:** `getUser node (GET /v1/user)` · **5 tests** · uses a `MOCK_USER` fixture.

| # | Test | What / how |
|---|---|---|
| 1 | calls GET /v1/user | Exactly one GET to the right URL. |
| 2 | signature = SHA256(timestamp + salt) with no extra fields | No signed fields for this endpoint. |
| 3 | sends Authorization Bearer header | `Authorization: Bearer <token>`. |
| 4 | stores full user model in context | `UserId`/`Msn` from the response persisted. |
| 5 | handles API error | 401 → `error` stored. |

### getStores.test.ts

- **Target:** [src/nodes/getStores.ts](../src/nodes/getStores.ts) — GET `/v1/stores` (optional `storeId`)
- **Suite:** `getStores node (GET /v1/stores)` · **7 tests** · `MOCK_STORES` fixture.

| # | Test | What / how |
|---|---|---|
| 1 | calls GET /v1/stores without storeId | Base call with empty `storeId`. |
| 2 | passes storeId as query param when provided | `params` = `{ storeId }`. |
| 3 | signature includes storeId when provided | Signed fields include `storeId`. |
| 4 | signature excludes storeId when empty | Empty `storeId` omitted from signature. |
| 5 | sends Authorization Bearer header | Bearer present. |
| 6 | stores stores response in context | `Stores` array (length 2) persisted. |
| 7 | handles API error | 401 → `error` stored. |

### getStoresMachinesStatus.test.ts

- **Target:** [src/nodes/getStoresMachinesStatus.ts](../src/nodes/getStoresMachinesStatus.ts) — GET `/v1/stores/machines/status` (optional `lastUpdateTime`)
- **Suite:** `getStoresMachinesStatus node (...)` · **7 tests** · `MOCK_STATUS` fixture.

| # | Test | What / how |
|---|---|---|
| 1 | calls GET /v1/stores/machines/status | Base call. |
| 2 | passes lastUpdateTime as query param when provided | `params` = `{ lastUpdateTime }`. |
| 3 | signature includes lastUpdateTime when provided | Signed field included. |
| 4 | signature excludes lastUpdateTime when empty | Omitted when empty. |
| 5 | sends Authorization Bearer header | Bearer present. |
| 6 | stores machine status response in context | `StoreMachinesStatus` persisted. |
| 7 | handles API error | 401 → `error` stored. |

### getReceipts.test.ts

- **Target:** [src/nodes/getReceipts.ts](../src/nodes/getReceipts.ts) — GET `/v1/receipts` (optional `storeId`, `dateFrom`)
- **Suite:** `getReceipts node (GET /v1/receipts)` · **8 tests** · `MOCK_RECEIPTS` fixture.

| # | Test | What / how |
|---|---|---|
| 1 | calls GET /v1/receipts | Base call. |
| 2 | passes storeId and dateFrom as query params | Both forwarded to `params`. |
| 3 | signature = SHA256(timestamp + storeId + dateFrom + salt) with both filters | Both signed, in order. |
| 4 | signature omits absent optional fields | Neither filter → `timestamp + salt`. |
| 5 | signature with only dateFrom, no storeId | Absent `storeId` skipped; only `dateFrom` signed. |
| 6 | sends Authorization Bearer header | Bearer present. |
| 7 | stores receipts response in context | `Logo` + `Receipts` persisted. |
| 8 | handles API error | 401 → `error` stored. |

### getSubscriptionUsers.test.ts

- **Target:** [src/nodes/getSubscriptionUsers.ts](../src/nodes/getSubscriptionUsers.ts) — GET `/v1/subscriptions/{id}/users`
- **Suite:** `getSubscriptionUsers node (...)` · **5 tests** · `MOCK_USERS` fixture.

| # | Test | What / how |
|---|---|---|
| 1 | calls GET with the id in the path | URL contains the `subscriptionId` path segment. |
| 2 | signature = SHA256(timestamp + subscriptionId + salt) | Exact signature. |
| 3 | sends Authorization Bearer header | Bearer present. |
| 4 | stores users response in context | `Users` array persisted. |
| 5 | handles API error | 401 → `error` stored. |

---

## Write node suites

### cancelSubscription.test.ts

- **Target:** [src/nodes/cancelSubscription.ts](../src/nodes/cancelSubscription.ts) — POST `/v1/subscriptions/cancel`
- **Suite:** `cancelSubscription node (...)` · **6 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST /v1/subscriptions/cancel | One POST issued. |
| 2 | sends subscriptionId as a number in the body | Body `{ subscriptionId: 53848 }` (string coerced to number). |
| 3 | signature = SHA256(timestamp + subscriptionId + salt) | Exact signature. |
| 4 | sends Authorization Bearer header | Bearer present. |
| 5 | stores success result in context | `{ success: true, ... }`. |
| 6 | handles API error | 400 → `error` stored. |

### addSubscriptionUser.test.ts

- **Target:** [src/nodes/addSubscriptionUser.ts](../src/nodes/addSubscriptionUser.ts) — POST `/v1/subscriptions/{id}/users`
- **Suite:** `addSubscriptionUser node (...)` · **6 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST with the id in the path | URL includes `subscriptionId`. |
| 2 | sends personalIdentifier in the body | Body `{ personalIdentifier }`. |
| 3 | signature = SHA256(timestamp + subscriptionId + personalIdentifier + salt) | Both fields signed, in order. |
| 4 | sends Authorization Bearer header | Bearer present. |
| 5 | stores success result in context | `{ success: true }`. |
| 6 | handles API error | 400 → `error` stored. |

### removeSubscriptionUser.test.ts

- **Target:** [src/nodes/removeSubscriptionUser.ts](../src/nodes/removeSubscriptionUser.ts) — DELETE `/v1/subscriptions/{id}/users/{userId}`
- **Suite:** `removeSubscriptionUser node (...)` · **5 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls DELETE with subscriptionId and userId in the path | URL has both path segments. |
| 2 | signature = SHA256(timestamp + subscriptionId + userId + salt) | Both fields signed. |
| 3 | sends Authorization Bearer header and no body | Bearer present; `request.data` is `undefined`. |
| 4 | stores success result in context | `{ success: true }`. |
| 5 | handles API error | 401 → `error` stored. |

### setPlateNumber.test.ts

- **Target:** [src/nodes/setPlateNumber.ts](../src/nodes/setPlateNumber.ts) — PUT `/v1/user/plate-number`
- **Suite:** `setPlateNumber node (...)` · **6 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls PUT /v1/user/plate-number | One PUT issued. |
| 2 | sends plateNumber in the body | Body `{ plateNumber }`. |
| 3 | signature = SHA256(timestamp + plateNumber + salt) | Exact signature. |
| 4 | sends Authorization Bearer header | Bearer present. |
| 5 | stores success result in context | `{ success: true }`. |
| 6 | handles API error | 401 → `error` stored. |

### issueCoupon.test.ts

- **Target:** [src/nodes/issueCoupon.ts](../src/nodes/issueCoupon.ts) — POST `/v1/coupons/issue` (optional `expirationDate`, `transactionId`)
- **Suite:** `issueCoupon node (...)` · **7 tests**

| # | Test | What / how |
|---|---|---|
| 1 | calls POST /v1/coupons/issue | One POST issued. |
| 2 | sends scheduleId as a number in the body (optionals omitted) | Body `{ scheduleId: 101 }` only. |
| 3 | includes optional fields in body and signature when present | Body + signature include `expirationDate` + `transactionId`. |
| 4 | signature = SHA256(timestamp + scheduleId + salt) with no optionals | Only `scheduleId` signed when optionals empty. |
| 5 | sends Authorization Bearer header | Bearer present. |
| 6 | stores success result in context | `{ success: true }`. |
| 7 | handles API error | 400 → `error` stored. |

---

## Cross-cutting security suite

### security.test.ts

- **Target:** All 14 nodes, run through the same secret-safety and robustness checks.
- **7 describe blocks · 21 written test blocks · ~61 expanded cases** (the salt-leak
  block uses `test.each` over all 14 nodes).
- **How:** A catch-all `mock.onAny(/.*/)` returns a superset success body so any node
  "succeeds", then the test inspects `api.addToContext`/`api.log` mock calls and
  `mock.history` for secret leakage. Some blocks override with error/network mocks.

| Describe block | Tests | What / how |
|---|---|---|
| Security: signatureSalt never leaks | 3 × `test.each` over 14 nodes (42 cases) | For every node, `signatureSalt` never appears in **(a)** anything written to context, **(b)** any log message, **(c)** any request header or body. |
| Security: apiKey only appears in X-Customer-Api-Key header | 1 × `test.each` over 2 nodes | `apiKey` is present in the `X-Customer-Api-Key` header but never written to context. |
| Security: appSecretKey never leaks | 2 | `requestSsoToken` never leaks `appSecretKey` (context/logs/headers/body); and it does **not** send `X-Customer-Api-Key`. |
| Security: secrets do not leak on API error | 2 | On a 500 response the `signatureSalt` isn't leaked; on a network error the `apiKey` isn't leaked. |
| Security: input sanitization | 7 | XSS in `ssoToken`; SQL-injection in `phone`; 100k-char `ssoToken`; null byte in `code`; unicode/emoji fields; XSS in `userId`; 100k-char `userId` — each must resolve without throwing. |
| Security: header integrity | 4 | Header profiles per node class: `requestSsoToken` (signature headers only); auth nodes (signature + api-key, no bearer); data nodes (signature + api-key + bearer); write nodes (signature + api-key + bearer). |
| Security: URL injection | 2 | A `javascript:` protocol in `baseUrl` (and in `appBaseUrl`) makes the request fail and the node stores an `error`. |

---

## Live integration suite

### integration.test.ts

- **Target:** The real sandbox API over HTTP (no mocks). Reimplements its own
  signature/header helpers rather than importing from `src`.
- **Suite:** `Integration: Liquid Barcodes Agent API (sandbox)` · **6 describe sections · 24 tests**
- **How / gating:** Every section is gated on `process.env` credentials via
  `HAS_CREDS ? describe : describe.skip` (and nested guards `HAS_OTP_CODE`,
  `HAS_DURABLE_SSO`, `HAS_APP_CREDS`, `HAS_FULL_SSO`). Without credentials the whole
  suite is skipped; individual tests also `return` early with `console.warn` when an
  optional secret is missing.

  > ⚠️ **These tests hit the live sandbox.** They are excluded from
  > `test:coverage:detailed` / `test:ci` so coverage runs stay deterministic. When
  > `.env` has credentials but the sandbox/token is stale, this suite will fail
  > (e.g. SSO exchange returns `undefined`) — that's an environment/credential issue,
  > not a code regression.

| Section | Tests | What it verifies |
|---|---|---|
| Section 1 — Signature validation | 1 | A deliberately wrong signature returns `401 INVALID_SIGNATURE`. |
| Section 2 — OTP Flow | 4 | `otp/start` sends an OTP to the test phone; empty phone → 400/401; `otp/verify` returns an access token (graceful skip if sandbox OTP not functional); that token fetches `/v1/user`. |
| Section 3 — Direct SSO Exchange (durable tokens) | 5 | Exchange a durable SSO token for an access token, then assert the response **shapes** of `/v1/user`, `/v1/stores`, `/v1/stores/machines/status`, `/v1/receipts` (field types + enum values). |
| Section 3b — Phase 1 write endpoints (signature verification) | 6 | Confirms the inferred signature field order for cancel / get-users / add-user / remove-user / issue-coupon / set-plate is accepted (never `401 INVALID_SIGNATURE`). Uses fake IDs so no real data is mutated; plate-number is read-modify-restore. |
| Section 4 — App API: SSO Token Generation | 2 | Invalid `UserId` → `ResponseStatus` error; valid `UserId` → a `Token` + `ExpirationDate`. |
| Section 5 — Full SSO chain (App API → Agent API → data) | 6 | End-to-end: generate SSO token (App API) → exchange for access token → fetch user, stores, machine status, receipts. |

---

## Known coverage gaps

Statements/lines/functions are at 100%; **branches sit at 73.91%**. The uncovered
branches are **not** unexecuted lines — they are the "value was missing" side of
defensive fallbacks that the tests never trigger because they always supply valid,
fully-populated data:

- `String(subscriptionId ?? '')` / `String(scheduleId ?? '')` — the `?? ''` (null id) side.
- `response.data ?? null` when writing to context — the `?? null` (empty response) side.
- `response.data.Stores?.length ?? 0` / `Receipts?.length ?? 0` — the missing-field side.

These are low-risk guard rails. To close them, add per-node cases that **(1)** mock a
`200` response with no `data`/`Stores`/`Receipts` field, and **(2)** invoke the node
with a missing id, then bump the `branches` threshold in
[jest.config.js](../jest.config.js). See the node suites above for the pattern to copy.
