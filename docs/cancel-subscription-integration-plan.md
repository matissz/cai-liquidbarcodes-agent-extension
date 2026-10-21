# Cancel Subscription Integration Plan

**Updated:** October 14, 2026  
**Milestone:** Deliver and validate the owner-only Cancel Subscription journey in Cognigy  
**Planning basis:** Confirmed LB answers summarized in [agent-api-cancellation-email-summary.md](./agent-api-cancellation-email-summary.md)

## Goal

Deliver a Cognigy cancellation flow that authenticates a customer, discovers the current car-wash subscription, permits cancellation only for its owner, submits the LB cancellation request, verifies the resulting state, and maps all confirmed outcomes to safe customer-facing behavior.

## Scope

### Included

- Sandbox authentication using LB-provided SSO test tokens.
- Subscription discovery through `GET /v1/user`.
- Handling of `subscriptions` and `sharedSubscriptions`.
- Owner/child role handling.
- Current subscription selection by approved car-wash `planId`, with a controlled `planName` fallback until the plan-ID list is agreed.
- Explicit customer confirmation before the destructive request.
- Owner cancellation through `POST /v1/subscriptions/cancel`.
- Post-cancellation verification through `GET /v1/user`.
- Confirmed business, authentication, authorization, and technical outcomes.
- Trace-ID retention and safe logging.
- Automated unit/contract tests and controlled sandbox validation.

### Excluded

- Cancellation reason.
- Subscription restart/reactivation.
- An idempotency-key implementation, because LB does not support one.
- Audit-event API integration until `GET /v1/audit-events` is released and included in scope.
- Unrelated extension use cases.

## Work Plan

### 1. Align the data model with the confirmed user contract

Update the user response types and tests to support:

- Canonical JSON field casing returned by the live API.
- `role` values `Owner` and `Child`.
- `subscriptions` for owned subscriptions.
- `sharedSubscriptions` for inherited family subscriptions.
- `planId`, `planName`, `subscriptionId`, `subscriptionState`, and `renewalDate`.

**Completion evidence:** Representative owner and child `GET /v1/user` payloads pass parsing and node tests without losing relationship metadata.

### 2. Define deterministic subscription selection

Implement or document flow logic that:

1. Reads fresh data from `GET /v1/user` for every cancellation attempt.
2. Selects only the approved car-wash plans.
3. Uses the current `subscriptionId`; it must not use a cached long-term ID.
4. Separates owned subscriptions from `sharedSubscriptions`.
5. Rejects child/shared subscriptions before presenting the destructive action.
6. Handles zero, one, or multiple matching owned subscriptions explicitly rather than selecting an arbitrary item.

**Dependency:** Obtain the production car-wash `planId` allowlist. Use `planName` only as an agreed temporary fallback.

**Completion evidence:** Tests cover no match, one owner match, child-only match, already-cancelled match, and multiple owner matches.

### 3. Confirm the cancellation interaction

The Cognigy flow must:

1. Show the selected subscription and relevant timing information.
2. Obtain explicit customer confirmation immediately before cancellation.
3. Avoid collecting a cancellation reason.
4. Call Cancel Subscription only for an owned subscription.

LB remains the authorization authority even when the flow performs an owner pre-check.

**Completion evidence:** A flow review demonstrates that no write request occurs without confirmation and that child/shared subscriptions cannot reach the cancellation node.

### 4. Normalize confirmed cancellation outcomes

Map provider outcomes to stable internal outcomes and customer-safe messages:

| Internal outcome | Provider result | Flow behavior |
|---|---|---|
| `cancelled` | `200` and verified as `Cancelled` or absent | Confirm cancellation and communicate end timing when available |
| `already_inactive` | Repeat request returns `200`; state already cancelled/absent | Treat as success; do not present an error |
| `not_owner` | `403`, `InvalidSubscriptionMemberId`, `91` | Explain that only the owner can cancel; do not retry |
| `not_found` | `404`, `SubscriptionNotFound`, `90` | Refresh user data and explain that the subscription is unavailable; do not retry cancellation |
| `session_invalid` | `401`, `SessionInvalid`, `1004` | Reauthenticate once, then retry once |
| `insufficient_scope` | `403`, `InsufficientScope`, `1005` | Stop; log as a configuration issue |
| `dependency_error` | `502`, `DependencyError`, `1008` | Verify state before any retry |
| `unexpected_error` | `500`, `UnexpectedError`, `1009` | Verify state before any retry |
| `failed` | Transport or unrecognized failure | Preserve trace information and route to safe fallback/support behavior |

Do not display LB's `detail` value directly. Select customer wording by stable `code` or internal outcome.

**Completion evidence:** Unit tests assert every mapping and the corresponding retry/no-retry decision.

### 5. Add post-action state verification

After `200`, timeout, `500`, or `502`, call `GET /v1/user` and evaluate the current subscription:

- Present with `subscriptionState: "Cancelled"` and `renewalDate`: cancellation is scheduled through that date.
- Missing from the current list: subscription has ended.
- Present and not `Cancelled`: cancellation is not confirmed.

Only resend after an uncertain response when a fresh user lookup still shows the current subscription as not cancelled. Bound all automatic retry behavior to prevent loops.

**Completion evidence:** Tests cover successful scheduled cancellation, immediately ended/disappeared subscription, timeout after provider success, and technical failure with unchanged state.

### 6. Protect diagnostics and support correlation

- Preserve `traceId` in the normalized error context.
- Log operation, outcome, status, error code, and trace ID.
- Never log SSO tokens, access tokens, signature salt, API keys, or full sensitive customer payloads.
- Retain enough information to support future audit-event lookup.

**Completion evidence:** Existing credential-leakage tests remain green and cancellation tests assert trace-ID propagation.

### 7. Expand automated tests

Add targeted tests for:

- Confirmed relationship and subscription response shape.
- All outcome mappings listed above.
- One-time reauthentication for `SessionInvalid`.
- No retry for not-owner, not-found, insufficient-scope, or invalid-signature outcomes.
- State verification before retry after timeout, `500`, and `502`.
- Idempotent handling of already-cancelled/ended subscriptions.
- Multiple subscription-selection scenarios.

State-changing sandbox tests must remain manually triggered until LB confirms that unattended automated cancellation is allowed.

### 8. Run controlled sandbox validation

After receiving approval for the test run:

1. Authenticate the owner through SSO.
2. Fetch and validate the owner's active subscription.
3. Cancel it and verify `Cancelled` plus `renewalDate`, or confirm that it disappeared.
4. Ask LB to restore the active subscription after the successful test.
5. Authenticate the child and verify shared-subscription visibility plus `403/91` on direct cancellation.
6. Authenticate the unrelated user and verify `403/91` against the owner's subscription.
7. Verify repeat cancellation of the already-cancelled subscription returns `200` without state change.
8. Verify the known-missing ID returns `404/90`.
9. Record trace IDs and redact all credentials from test evidence.

**Completion evidence:** A dated test record captures expected versus actual results for each scenario and LB restores or replaces mutable test data as needed.

### 9. Complete milestone acceptance

The milestone is complete when:

- The extension and Cognigy flow implement the confirmed contract.
- Automated tests pass for all confirmed paths.
- Controlled sandbox tests pass for owner success, child/unrelated rejection, already-cancelled success, and not-found failure.
- Timeout/technical-failure state verification is tested at least through mocks if it cannot be induced safely in sandbox.
- No unresolved issue blocks safe production cancellation behavior.
- Stakeholders review and accept the demonstrated flow.

## External Dependencies and Decisions

| Dependency | Owner | Required before |
|---|---|---|
| Confirm whether automated state-changing tests require prior approval | LB | Scheduling unattended integration tests |
| Restore the active sandbox subscription after successful cancellation | LB | Repeating owner-success E2E tests |
| Provide/confirm car-wash `planId` allowlist | LB/business | Final production subscription-selection rule |
| Provide expected peak and concurrent Agent API volumes | CK | LB rate-limit definition |
| Confirm availability of `GET /v1/audit-events` | LB | Any future audit-query integration |

## Immediate Next Actions

1. Update user-response typing and fixtures for `role` and `sharedSubscriptions`.
2. Define subscription-selection behavior for zero, one, and multiple matches.
3. Implement cancellation outcome normalization and post-action verification.
4. Add targeted automated tests.
5. Request/record permission before running state-changing automation.
6. Execute the controlled sandbox matrix and request manual reset after owner cancellation.
