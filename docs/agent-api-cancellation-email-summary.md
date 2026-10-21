# Agent API Cancellation Conversation Summary

**Conversation period:** September 30–October 14, 2026  
**Latest response:** Liquid Barcodes, October 14, 2026  
**Purpose:** Record the cancellation-related decisions from the email thread in a readable, implementation-oriented form.

> The source email contains sandbox credentials and personal contact details. Those values are intentionally excluded from this document and must not be committed to source control. Obtain current test credentials through the approved secure channel.

## Executive Summary

Liquid Barcodes (LB) has supplied reserved sandbox accounts and SSO test tokens for the main cancellation scenarios. This removes the fixed-OTP dependency and makes end-to-end cancellation testing possible through `POST /v1/auth/sso`.

The cancellation contract is now sufficiently defined to continue implementation and begin controlled end-to-end validation. The only immediate test-execution blocker still awaiting confirmation is whether automated cancellation tests may run without prior approval. Successful cancellation also requires a manual reset by LB before the same active subscription can be tested again.

## Confirmed Contract

### Authentication and sandbox data

- Reserved sandbox identities exist for:
  - The owner of an active multi-user car-wash subscription.
  - A child/family member on that subscription.
  - An unrelated user who owns an already-cancelled subscription.
- Each test identity has an SSO test token.
- Tests can authenticate with `POST /v1/auth/sso`; a fixed OTP is not needed.
- LB supplied scenario-specific subscription IDs and a known-nonexistent ID in the source email.
- Cancellation of the active test subscription can be reset only by LB through a manual process.
- The already-cancelled subscription may disappear from `GET /v1/user` after its current period ends, after which LB must provide a replacement.

### Subscription discovery

- `GET /v1/user` is the authoritative source for current subscriptions.
- Car-wash subscriptions must be identified by an agreed `planId`, or by `planName` when necessary; there is no product-type field.
- The current `subscriptionId` must always be read from `GET /v1/user` rather than stored long term.
- A `subscriptionId` remains stable across ordinary renewals.
- Upgrades and downgrades create a new subscription and retire the old one.

### Ownership and shared subscriptions

- The only subscription role values are `Owner` and `Child`.
- A user's own subscriptions are returned in `subscriptions`.
- Family-inherited subscriptions are returned in `sharedSubscriptions` with role `Child`.
- A child can view the shared subscription but cannot cancel it.
- LB enforces authorization from the authenticated user represented by the access token. Possession of a valid subscription ID is not sufficient.
- Only the owner may cancel.

### Cancellation behavior

- Endpoint: `POST /v1/subscriptions/cancel`.
- Input: authenticated access token and numeric `subscriptionId`.
- Success: `200 OK` with an empty response body.
- Cancellation normally takes effect at the end of the current billing period.
- A delayed-start subscription that has not activated, or a subscription currently renewing, can end immediately.
- After successful scheduled cancellation, `GET /v1/user` returns:
  - `subscriptionState: "Cancelled"` immediately.
  - `renewalDate` as the date the subscription ends.
- `renewalState` does not change because of cancellation and must not be used to determine cancellation status.
- If the subscription no longer appears in `GET /v1/user`, it has ended.
- A cancelled subscription can be restarted through the app until its period ends. Restart is not available through Agent API.
- Cancellation reason is not part of V1 and must not be added until LB defines its storage and reporting contract.

## Outcome Contract

| Scenario | HTTP | Code | Error code | Retry guidance |
|---|---:|---|---:|---|
| Cancelled | `200` | — | — | Verify with `GET /v1/user` |
| Already cancelled or ended | `200` | — | — | Treat as idempotent success |
| Authenticated user is not owner | `403` | `InvalidSubscriptionMemberId` | `91` | Do not retry |
| Subscription does not exist | `404` | `SubscriptionNotFound` | `90` | Do not retry |
| Unexpected LB failure | `500` | `UnexpectedError` | `1009` | Check `GET /v1/user` before retrying |
| Downstream dependency unavailable | `502` | `DependencyError` | `1008` | Check `GET /v1/user` before retrying |
| Session invalid | `401` | `SessionInvalid` | `1004` | Reauthenticate once, then retry |
| Session lacks permission | `403` | `InsufficientScope` | `1005` | Do not retry; configuration issue |

Failure responses use Problem Details and include `status`, `detail`, `code`, numeric `errorCode`, `instance`, and `traceId`.

Customer-facing text should be selected by the Cognigy flow from the stable `code`. The provider's `detail` value should not be shown directly to the customer.

## Timeout and Duplicate Protection

The endpoint does not accept an idempotency key. Repeated cancellation of an already-cancelled subscription returns `200` and does not change state.

After a timeout or uncertain response:

1. Call `GET /v1/user`.
2. If the current subscription is present with `subscriptionState: "Cancelled"`, treat the cancellation as successful and do not resend it.
3. If the subscription has disappeared, treat it as ended and do not resend it.
4. Resend cancellation only if the current subscription is still present and is not `Cancelled`.

## Audit and Support

- The calling integration is identified from Agent API credentials (`CustomerAuthConfigId`), not from a cancellation request field.
- All cancellation requests are audited, including rejected requests.
- Audit information includes the trace ID, UTC timestamp, operation, customer/member, HTTP outcome, error code, duration, client information, session hash, and calling integration.
- `GET /v1/audit-events` lookup by user ID or phone number is in testing.
- Retain `traceId` as the support-correlation identifier.

## Remaining Open Items

| Item | Status | Impact |
|---|---|---|
| Permission to run automated cancellation tests without prior approval | Awaiting LB confirmation | Do not schedule or repeatedly run state-changing automated tests until confirmed |
| Sandbox reset turnaround time/service expectation | Manual reset confirmed; timing not stated | Limits repeatability and test scheduling |
| Car-wash `planId` allowlist for production selection | LB indicated plan IDs can be shared; final list is not recorded in the thread | Subscription-selection rules cannot rely exclusively on `planId` yet |
| Agent API rate limits and deterministic `429` contract | Not defined | CK must provide expected peak and concurrent request volumes before LB defines limits |
| Audit endpoint availability | In testing | Audit verification may need to wait |

## Superseded Questions

The following previous uncertainties are resolved:

- Fixed OTP is unnecessary because sandbox SSO tokens are available.
- Ownership values and shared-subscription placement are confirmed.
- Cancellation is owner-only and enforced by LB.
- Scheduled versus completed cancellation can be determined with `GET /v1/user`.
- Repeated cancellation is an idempotent `200`; there is no idempotency key.
- Error codes and retry guidance are defined for the required scenarios.
- Cancellation reason is out of scope for V1.
- The canonical signature error is `InvalidSignature` / `1003`.
- Bootstrap failures use `AuthenticationFailed` / `1002`; `BOOTSTRAP_VALIDATION_FAILED` is not a separate code.
