# Agent API Partner Integration Guide (V1) — Rephrased Reference

> Rephrased from the partner-provided V1 guide for future node development and Cognigy flow design.

## 1. Overview and authentication

The Agent API allows a partner customer-care chatbot to manage subscriptions, issue courtesy coupons, inspect customer activity, update profile data, and manage app devices for authenticated mobile-app customers.

Authorization is always tied to the authenticated customer session. Device IDs are not required, and customer identifiers in request bodies do not determine authorization.

### Request headers and signatures

Every request sends `X-Customer-Api-Key`, `X-Liquid-Timestamp`, and `X-Liquid-Signature`. The timestamp must be within 10 minutes of server time. Authenticated operations also require:

```http
Authorization: Bearer <accessToken>
```

The signature is a lowercase hexadecimal SHA-256 digest. Hash the trimmed values concatenated without separators, in this order:

1. Timestamp.
2. Operation-specific signed values.
3. Liquid Barcodes signature salt.

The signature salt is separate from the API key and bearer token. Neither of those values is included in the signed string.

| Operation | Additional signed values |
|---|---|
| `PUT /v1/user/default-payment-method` | `defaultPaymentMethodId` as digits |
| `GET /v1/audit-events` | `userId`, `phone`, and `limit`; empty strings represent omitted values |
| `PUT /v1/user/emails` | No body values |
| `PUT /v1/user/preferred-stores` | No body values |
| `PUT /v1/user/external-identifiers` | No body values |

### Sign-in

SSO uses `POST /v1/auth/sso` with `{ "ssoToken": "..." }`. The token may contain letters and digits and may be up to 64 characters.

OTP uses `POST /v1/auth/otp/start` with a 7–13 digit phone number, followed by `POST /v1/auth/otp/verify` with the phone and a 4–8 digit code. Phone values contain digits only, including the country code.

Both successful SSO and OTP verification responses provide `{ "accessToken": "...", "expiresInSeconds": 3600 }`. Sessions last one hour and are not extended by use. There is no refresh endpoint. On `AuthenticationFailed` (`1002`) or `SessionInvalid` (`1004`) from an authenticated operation, re-authenticate once and retry.

Authentication errors are intentionally generic. OTP start returns `200` even when the number is unknown, blocked, or rate-limited. Malformed values return `400 InvalidInput` (`1001`).

### Permission scopes

Missing integration permissions return `403 InsufficientScope` (`1005`).

| Scope | Operations |
|---|---|
| `user-devices:read` | `GET /v1/user/devices/limit` |
| `user-devices:write` | `POST /v1/user/devices/clear` |
| `coupon:issue` | `GET /v1/coupons/eligibility`, `POST /v1/coupons/issue` |

## 2. Error handling

Errors follow RFC 9110 Problem Details and include `type`, `title`, `status`, `detail`, `instance`, `code`, numeric `errorCode`, and `traceId`. Retain `traceId` for support requests and use `code` for customer-facing routing instead of exposing `detail` directly.

| HTTP | Code | Error code | Meaning and handling |
|---:|---|---:|---|
| 400 | `InvalidInput` | 1001 | Correct validation errors; do not retry unchanged |
| 401 | `AuthenticationFailed` | 1002 | Re-authenticate once for authenticated calls |
| 401 | `InvalidSignature` | 1003 | Correct signature or clock; do not retry unchanged |
| 401 | `SessionInvalid` | 1004 | Re-authenticate once |
| 403 | `InsufficientScope` | 1005 | Contact Liquid Barcodes; do not retry |
| 409 | `RequestRejected` | 1000 | Request is invalid in the current state |
| 409 | `DuplicateIdempotencyKey` | 1007 | Do not use the ID for a different operation |
| 502 | `DependencyError` | 1008 | Check current state before retrying |
| 500 | `UnexpectedError` | 1009 | Check current state before retrying |
| 400 | `InvalidSubscriptionId` | 89 | Invalid subscription ID format |
| 400 | `SubscriptionNotFound` | 90 | Subscription does not exist |
| 403 | `InvalidSubscriptionMemberId` | 91 | Caller is not the owner |
| 409 | `CouponLimitExceeded` | 1010 | Coupon schedule limit reached |
| 409 | `SubscriptionRebateLimitReached` | 2001 | Rebate limit reached |
| 409 | `SingleWashCodeNotEligible` | 2002 | Active single-wash-code limit reached |
| 409 | `DeviceClearLimitReached` | 140 | Device-clear limit reached; try later |
| 409 | `QuarantinedSubscriptionUsers` | 126 | Family plan temporarily cannot accept users |
| 400 | `PlateNumberUpdateLimit` | 77 | Plate update is temporarily restricted |
| 400 | `UserGroupUpdateFailed` | 44 | Group change could not be applied |

Legacy uppercase names such as `INVALID_INPUT` and `INVALID_SIGNATURE` should be treated as aliases of the current names.

## 3. User and subscription data

### Get user (`GET /v1/user`)

This is the authoritative read for the authenticated customer's profile and current subscriptions.

- `subscriptions` contains plans owned by the customer (`role: Owner`).
- `sharedSubscriptions` contains family plans owned by another customer (`role: Child`).
- A temporary shared-plan loading failure may appear as an empty array; repeat the read before concluding that no shared plan exists.
- Subscription states include `Active`, `Cancelled`, `ToActivateWithDelay`, and `Downgrading`.
- Renewal states include `SubscriptionStarted`, `RenewalSucceeded`, `MonthlyLimitReached`, `RenewingInProgress`, and `ToActivateWithDelay`.
- Identify products using `planId` or `planName`; no dedicated product-type field exists.
- Always read the current `subscriptionId` from this endpoint because upgrades and downgrades can create a new ID.

Subscription records can include plan, role, balance, renewal, delayed-start, multi-user, and accumulation-limit properties. The response can also include contact data, consents, groups, payment methods, plate number, external identifiers, preferred stores, referral data, and age-verification information.

## 4. Subscription management

### Cancel subscription (`POST /v1/subscriptions/cancel`)

```json
{ "subscriptionId": 79004 }
```

Only an `Owner` can cancel. Cancellation normally applies at the end of the current billing period. A not-yet-active delayed-start plan is removed immediately instead of becoming `Cancelled`; an in-progress renewal is not completed.

After success, verify with `GET /v1/user`: the subscription should be `Cancelled` with its period-end date. Once ended, it disappears. V1 does not support cancellation reasons or API reactivation.

Cancellation is state-idempotent: repeated requests return `200` without cancelling twice. After a timeout, verify state before resending and never send parallel cancellation requests.

### Family-plan users

For a multi-user plan, obtain the current ID from `GET /v1/user` and use:

| Operation | Endpoint | Notes |
|---|---|---|
| List | `GET /v1/subscriptions/{subscriptionId}/users` | Returns member record IDs and personal identifiers |
| Add | `POST /v1/subscriptions/{subscriptionId}/users` | Body: `{ "personalIdentifier": "..." }` |
| Remove | `DELETE /v1/subscriptions/{subscriptionId}/users/{id}` | Use the ID returned by list; no response body |

Adding can return `QuarantinedSubscriptionUsers` (`126`). `maxUsersAmount` indicates capacity.

## 5. Audit events

`GET /v1/audit-events` uses signed headers but no bearer token. Supply exactly one of `userId` or `phone`, plus an optional `limit` from 1 to 500 (default 100). Results are newest first and contain event time, method, path, status, error code when applicable, and user ID when known. No matches return `[]`. Audit calls are not recorded, and logging is not retroactive.

## 6. Coupons

### Check eligibility (`GET /v1/coupons/eligibility`)

Requires `coupon:issue` and a positive `scheduleId`. A successful response is `{ "scheduleId": 34897, "eligible": true }`. Ineligibility may return `CouponLimitExceeded` (`1010`), `SubscriptionRebateLimitReached` (`2001`), `SingleWashCodeNotEligible` (`2002`), or `RequestRejected` (`1000`). Eligibility does not reserve a coupon; issuance checks are repeated.

### Issue coupon (`POST /v1/coupons/issue`)

```json
{
  "scheduleId": 34897,
  "expirationDate": "2026-12-31T23:59:59.000Z",
  "transactionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

`scheduleId` is required. `expirationDate` is optional but must be future-dated when supplied. `transactionId` is required, unique per intended coupon, and at most 128 characters. Reuse the same ID only when retrying the same uncertain request. A duplicate returns `DuplicateIdempotencyKey` (`1007`) and does not issue another coupon.

Only Liquid Barcodes-approved schedules can be issued. Success returns `contentId` and `scheduleId`; the coupon is viewed in the mobile app. Unavailable schedules return `RequestRejected` (`1000`).

## 7. Profile, consent, and group operations

Profile writes act on the authenticated user and return the updated user object.

| Endpoint | Body or purpose |
|---|---|
| `PATCH /v1/user` | Update `msn`, name, address fields, or plate object; send only changed fields |
| `PATCH /v1/user/name` | `name` and/or `surname` |
| `PATCH /v1/user/address` | `address`, `postCode`, and/or `city` |
| `PUT /v1/user/msn` | Country code and digits, without `+` |
| `PUT /v1/user/plate-number` | Plate string; may return `PlateNumberUpdateLimit` (`77`) |
| `PUT /v1/user/gender` | `M`, `F`, `O`, or empty string |
| `PUT /v1/user/culture` | RFC 4646 culture code |
| `PUT /v1/user/date-of-birth` | ISO `yyyy-mm-dd` |
| `PUT /v1/user/emails` | Replaces the full email list |
| `PUT /v1/user/preferred-stores` | Replaces store IDs, most preferred first |
| `PUT /v1/user/external-identifiers` | Replaces the full identifier list |
| `PUT /v1/user/default-payment-method` | Payment method ID from the profile; value is signed |

Approve or revoke consent with `POST` or `DELETE /v1/user/consents/{consentId}`. Join or leave groups with `POST` or `DELETE /v1/user/groups/{groupId}`. Code-configurable groups accept `{ "userCode": "..." }`; non-configurable groups cannot be changed. Failed group changes return `UserGroupUpdateFailed` (`44`).

## 8. App devices

`GET /v1/user/devices/limit` requires `user-devices:read` and returns `{ "limitReached": true|false }`.

`POST /v1/user/devices/clear` requires `user-devices:write` and accepts a unique transaction ID up to 128 characters. Success returns `Cleared` or `NothingToClear`. Rejections include `DeviceClearLimitReached` (`140`), `DuplicateIdempotencyKey` (`1007`), and `RequestRejected` (`1000`).

## 9. Stores, machines, and receipts

- `GET /v1/stores` optionally accepts `storeId` and returns store identity, address, coordinates, contact details, state, hours, and notes. States include `Open`, `Closed`, `TemporarilyClosed`, and `PermanentlyClosed`.
- `GET /v1/stores/machines/status` optionally accepts ISO `lastUpdateTime`. Store status is `Available` when any machine is available and `OutOfService` when all are out of service. Machine states include `Available`, `OutOfService`, and `Offline`.
- `GET /v1/receipts` optionally accepts `storeId` and ISO `dateFrom`. The `receipt` property contains escaped transaction JSON and may require parsing. Use generous timeouts because this call can be slow.

## 10. Rate limits and sandbox

No Agent API rate limits or `429` responses are currently configured. Limits may be introduced after partner traffic expectations are established.

Sandbox:

```text
https://agent.api.sandbox.eu1.l-b.dev
```

Liquid Barcodes supplies reserved test users and SSO tokens for owner, family-member, unrelated-user, and already-cancelled scenarios. Cancelled test subscriptions require a manual reset. The production URL is supplied separately for each environment.

## 11. Guidance for extension nodes

1. Use `GET /v1/user` as the source of current profile and subscription state.
2. Sign only the operation-specific values documented for each endpoint.
3. Keep API keys, salts, bearer tokens, and OTP values out of context outputs and logs.
4. Validate required node fields before sending requests where practical.
5. Route on stable API error codes, including re-authentication and retryable outcomes.
6. Preserve `traceId` for diagnostics without exposing secrets.
7. Reuse transaction IDs only for retries of the same coupon or device-clear request.
8. Verify state after uncertain state-changing operations.
9. Read subscription IDs afresh instead of persisting them permanently.
10. Add unit, security, and integration tests for every newly exposed node.
