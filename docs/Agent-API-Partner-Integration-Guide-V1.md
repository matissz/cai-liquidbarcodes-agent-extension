# Agent API — Partner Integration Guide (V1)

The Agent API allows Circle K's customer-care chatbot to manage subscriptions, issue courtesy coupons, and review customer interaction histories on behalf of authenticated Circle K mobile app customers.

## 1. Overview & Authentication

All Agent API operations execute in the context of an authenticated customer session. No device ID is required. Authorization is strictly bound to the authenticated customer behind the session, never on customer identifiers supplied in the request.

Every request carries the `X-Customer-Api-Key`, `X-Liquid-Timestamp`, and `X-Liquid-Signature` headers (see Request headers and signature on the API reference). The timestamp must be within ±10 minutes of server time. All endpoints except sign-in and audit events also require `Authorization: ******`.

### 1.1 Authentication Methods

A customer session can be established through two methods:

- **In-App SSO Handoff:** `POST /v1/auth/sso` with body `{ "ssoToken": "…" }` validates the customer's app Single Sign-On (SSO) token and creates an active session. `ssoToken` is letters and digits only, up to 64 characters.
- **Web Phone + OTP:** `POST /v1/auth/otp/start` with body `{ "phone": "4791234567" }` sends a one-time PIN (OTP) to the customer's mobile phone number and returns `{ "phone": "4791234567" }`. `POST /v1/auth/otp/verify` with body `{ "phone": "4791234567", "code": "1234" }` validates the PIN and establishes an active session. `phone` is digits only (no `+` or spaces), 7–13 digits including the country code; `code` is digits only, 4–8 digits.

To prevent account enumeration, authentication failures are intentionally generic:

- **Session Response:** Both SSO and OTP verify return `{ "accessToken": "…", "expiresInSeconds": 900 }`. Send `accessToken` as `Authorization: ******` on subsequent requests.
- `otp/start` returns the same `200 OK` response whether a phone number is registered, blocked, or rate-limited.
- Verification and SSO handoff failures return a generic `AuthenticationFailed` error.
- Malformed input (for example, non-digit characters in `phone`) returns `400 InvalidInput` (`1001`).

### 1.2 Session Lifecycle

- **Session Expiry:** An active session lasts 15 minutes from sign-in. A successful sign-in response includes `expiresInSeconds`. The lifetime is fixed; using the session does not extend it.
- **Re-authentication:** There is no token refresh endpoint. A request with an expired or unknown session returns `401 AuthenticationFailed` (`1002`), or in rare cases `401 SessionInvalid` (`1004`). On either code from an authenticated endpoint, the chatbot must re-authenticate the customer once to obtain a new session, then retry.

## 2. Error Format & Error Codes

### 2.1 RFC 9110 Problem Details

All error responses conform to RFC 9110 Problem Details and contain: `type`, `title`, `status`, `detail`, `instance`, `code`, numeric `errorCode`, and `traceId`.

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  "title": "Forbidden.",
  "status": 403,
  "detail": "Only the subscription owner can perform this action.",
  "instance": "/v1/subscriptions/cancel",
  "code": "InvalidSubscriptionMemberId",
  "errorCode": 91,
  "traceId": "00-…"
}
```

> **Note:** Always retain `traceId` when reporting issues to Liquid Barcodes. The `detail` field contains generic descriptive text; the chatbot should derive customer-facing messaging from `code` rather than displaying `detail` directly.

### 2.2 Error Codes & Retry Policy

| Status | Code | Error code | Meaning | Retry guidance |
|---:|---|---:|---|---|
| 400 | `InvalidInput` | 1001 | Request validation failed | Do not retry; correct the request. |
| 401 | `AuthenticationFailed` | 1002 | Authentication failed (generic; covers bootstrap validation failures and expired or unknown sessions) | On sign-in, do not retry with the same credentials; on other endpoints, re-authenticate once, then retry. |
| 401 | `InvalidSignature` | 1003 | Request signature invalid, or timestamp outside the ±10-minute window. `INVALID_SIGNATURE` in older references represents the same condition. | Do not retry; correct the request signature or client clock. |
| 401 | `SessionInvalid` | 1004 | Session missing, expired, or invalid | Re-authenticate once to obtain a new session, then retry. |
| 403 | `InsufficientScope` | 1005 | Session lacks permission for the requested operation | Do not retry; contact Liquid Barcodes to resolve configuration. |
| 409 | `RequestRejected` | 1000 | Request could not be completed in the current state | Do not retry unchanged. |
| 409 | `DuplicateIdempotencyKey` | 1007 | Coupon `transactionId` already used | Do not retry with the same `transactionId`. |
| 502 | `DependencyError` | 1008 | Downstream service unavailable | Check current state via `GET /v1/user`, then retry if needed. |
| 500 | `UnexpectedError` | 1009 | Internal unexpected failure | Check current state via `GET /v1/user`, then retry if needed. |
| 400 | `InvalidSubscriptionId` | 89 | Subscription ID has an invalid format | Do not retry. |
| 404 | `SubscriptionNotFound` | 90 | Subscription not found | Do not retry. |
| 403 | `InvalidSubscriptionMemberId` | 91 | Authenticated caller is not the subscription owner | Do not retry. |

## 3. User & Subscriptions

### 3.1 Discover Subscriptions (`GET /v1/user`)

`GET /v1/user` is the authoritative endpoint for retrieving the authenticated customer's profile and their associated subscriptions.

- **Owner Subscriptions (`subscriptions`):** Subscriptions owned directly by the customer (`role = Owner`). Only current subscriptions are listed (active, renewing, or awaiting a delayed start).
- **Shared Subscriptions (`sharedSubscriptions`):** Subscriptions accessible via a multi-user/family plan owned by another customer (`role = Child`). If shared subscriptions temporarily cannot be loaded, an empty array is returned instead of an error; repeat the request before concluding the customer has no shared plan.
- **Role Values (`role`):** Returned as either `Owner` or `Child`.
- **Subscription State (`subscriptionState`):** `Active`, `Cancelled`, `ToActivateWithDelay`, or `Downgrading`.
- **Subscription Model:** Contains `planName`, `role`, `subscriptionId`, `subscriptionState`, `renewalState`, `contentId`, `isMultiUserPlan`, `maxUsersAmount`, `planId`, `renewalDate`, `renewalPrice`, and `currentBalance`.
- **Product Identification:** There is no dedicated product-type field. Identify car-wash subscriptions using `planId` or `planName`.
- **Subscription ID Stability:** `subscriptionId` remains unchanged across regular billing renewals. However, plan upgrades or downgrades generate a new subscription with a new `subscriptionId`. Always fetch the current `subscriptionId` from `GET /v1/user` rather than persisting it long-term.

#### Example Response

A customer who owns one plan and shares another (profile fields omitted):

```json
{
  "subscriptions": [
    {
      "planName": "Coffee subscription - Small(S)",
      "role": "Owner",
      "subscriptionId": 79004,
      "subscriptionState": "Active",
      "renewalState": "RenewalSucceeded",
      "contentId": 59086774,
      "isMultiUserPlan": false,
      "maxUsersAmount": 0,
      "planId": 1940,
      "renewalDate": "2026-10-08T03:59:59.0000000+00:00",
      "renewalPrice": 9.99,
      "currentBalance": 0.0
    }
  ],
  "sharedSubscriptions": [
    {
      "planName": "Coffee subscription - Small(S) - Multiuser",
      "role": "Child",
      "subscriptionId": 79403,
      "subscriptionState": "Active",
      "renewalState": "RenewalSucceeded",
      "contentId": 59086771,
      "isMultiUserPlan": true,
      "maxUsersAmount": 3,
      "planId": 1943,
      "renewalDate": "2026-10-08T03:59:59.0000000+00:00",
      "renewalPrice": 29.99,
      "currentBalance": 0.0
    }
  ]
}
```

## 4. Subscription Management

### 4.1 Cancel Subscription (`POST /v1/subscriptions/cancel`)

Cancels an active subscription owned by the authenticated customer.

#### Request Body

```json
{
  "subscriptionId": 79004
}
```

#### Response & Outcomes

| Outcome | HTTP status and response body | Retry action |
|---|---|---|
| Cancelled successfully | `200 OK`, body `{}` | None |
| Already cancelled or ended | `200 OK`, body `{}` (no state change) | None |
| Invalid `subscriptionId` (for example, `0`) | `400 Bad Request`, `InvalidInput`, error code `1001` | Do not retry |
| Not the plan owner | `403 Forbidden`, `InvalidSubscriptionMemberId`, error code `91` | Do not retry |
| Subscription not found | `404 Not Found`, `SubscriptionNotFound`, error code `90` | Do not retry |
| Technical failure | `500` (`1009`) or `502` (`1008`) | Query `GET /v1/user` first; retry only if status is not `Cancelled` |

- **Authorization:** Only the plan owner (`Owner`) can cancel a subscription. Passing a valid `subscriptionId` as a non-owner (family member or unrelated customer) results in a `403` rejection.
- **Effective Timing:** Cancellation normally takes effect at the end of the current billing period (the renewal date). Exceptions:
  - Delayed-start subscriptions that have not yet activated end immediately and are removed from `GET /v1/user` straight away (they do not appear as `Cancelled`).
  - Subscriptions currently in the middle of renewing are not renewed; the in-progress renewal is not completed.
- **Post-Cancellation State:** Following a successful cancellation, `GET /v1/user` returns `subscriptionState = Cancelled` immediately, and `renewalDate` reflects the end date. `renewalState` is not changed by cancellation; rely on `subscriptionState`. Once fully ended, the subscription no longer appears in the list.
- **Cancellation Reason:** Not supported in V1; do not supply a reason in the request body.
- **Reactivation:** Not available through the Agent API. Customers can restart a cancelled plan in the mobile app until the period ends.

> **Retries:** There is no idempotency key for cancellations. A repeated cancel request returns `200 OK` and does not cancel the subscription twice. After a network timeout, always check the subscription state via `GET /v1/user` before resending, and do not send parallel cancel requests for the same subscription.

## 5. Customer Audit Trail

### 5.1 Query Audit Logs (`GET /v1/audit-events`)

Retrieves the audit trail of Agent API requests performed for a given customer.

- **Authentication:** Signed request headers only; no customer session (`Authorization`) is required. Signed values: `userId`, `phone`, `limit` (raw query-string values, empty when absent).
- **Query Parameters:**
  - Exactly one identifier: `userId` or `phone` (digits only, same format as sign-in). Passing neither or both returns `400 Bad Request`.
  - Optional `limit` from 1 to 500 (default: 100).
- **Response:** Array of events, newest first, each with `occurredAt`, `method`, `path`, `statusCode`, `errorCode` (error code string, omitted on success), and `userId` (when known).
- **Empty Results:** Returns `[]` if no matching records exist.
- **Scope & Privacy:** No additional permission scope is required. Each integration can only view its own audit records. Calls to `/v1/audit-events` itself are not included.
- **Recorded Operations:** Every request is logged, including sign-in attempts and rejected operations such as not-owner or not-found.

> **Note:** Audit logging does not backfill historical operations; activity is recorded from the date audit logging was enabled.

## 6. Courtesy Coupons

### 6.1 Issue Coupon (`POST /v1/coupons/issue`)

Issues a coupon directly to the authenticated customer. The issued coupon appears in the customer's mobile app.

- **Request Parameters:** `scheduleId` (the pre-configured coupon schedule to issue), optional `expirationDate` (ISO 8601, must be in the future), and required `transactionId` (client-generated, unique per intended coupon, up to 128 characters) so that a retried request does not issue a second coupon.
- **Duplicate Protection:** A `transactionId` can be used once per integration within 24 hours. A repeat of a request that succeeded or is still in progress returns `409 DuplicateIdempotencyKey` (`1007`); no second coupon is issued and the original response is not replayed. If the original request failed, the same `transactionId` can be retried. After a timeout, retry with the same `transactionId`.
- **Allowed Schedules:** Only coupon schedules agreed with and configured by Liquid Barcodes for the integration can be issued; other schedule IDs are rejected with `403 InsufficientScope` (`1005`).
- **Response Body:** Returns `contentId` and `scheduleId`. The response does not contain the coupon code or expiration date; the customer finds and redeems the coupon in the app.
- **Coupon Not Issued:** If the schedule cannot currently issue a coupon (for example, it is inactive), the request returns `409 RequestRejected` (`1000`).
- **Issuance Limits:** Limits for chatbot coupon issuance (maximum 1 subscription rebate per customer per 30 days; maximum 2 active single-wash codes) are in development. **TODO:** Document limits and their error codes when released.

## 7. Rate Limits & Sandbox Testing

### 7.1 Rate Limits

No rate limits are currently configured for the Agent API, and no `429 Too Many Requests` responses are returned. Limits will be defined based on Circle K's expected peak and concurrent traffic volumes.

### 7.2 Sandbox Testing

- **Base URL:** <https://agent.api.sandbox.eu1.l-b.dev>
- **Test Accounts:** Liquid Barcodes supplies pre-configured test customers (plan owner, family member, unrelated customer, already-cancelled subscription) with test SSO tokens for automated testing without an SMS PIN. Credentials are shared separately.
- **Subscription Resets:** Test subscriptions cancelled during testing are reset manually by Liquid Barcodes on request.
