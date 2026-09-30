# Liquid Barcodes Agent API: Cancellation Path Questions

**Subject:** Agent API clarification and sandbox requirements for subscription cancellation

Hi Liquid Barcodes team,

Thank you for sharing the current Agent API development status. We understand that the Agent API is still being expanded and that the existing sandbox has limited data and capabilities.

For the current delivery, we are focusing on the subscription cancellation path. We do not require a separate App API environment. Testing will use the authenticated Liquid Barcodes user context established through in-app SSO or web phone and OTP.

To complete the cancellation implementation and end-to-end validation, we need clarification on the following points.

## 1. Sandbox and Test Data

Can the existing sandbox be expanded, or can controlled test data be provided, for these scenarios?

- An authenticated owner with an active, cancellable car-wash subscription.
- A family member with access to a parent-owned subscription.
- An inactive or already-cancelled subscription.
- A subscription ID that does not exist.
- A repeatable way to restore or recreate the active subscription after cancellation.

For state-changing tests, please also confirm:

- Whether cancellation tests may run automatically or require prior approval.
- How test data should be reset after a successful cancellation.
- Whether stable test identities and subscriptions can be reserved for CK integration testing.
- Whether sandbox authentication, authorization, and cancellation behavior match the intended production contract.
- Whether a manual reset process is available if automatic reset is not possible, including the expected turnaround time.

## 2. Authentication and User Context (`CK-API-001`)

The documented contract establishes that both SSO and OTP return an access token used as the Bearer token for subsequent Agent API calls. The cancellation request requires that token and a `subscriptionId`; it does not require a device ID.

- Is a fixed OTP or another controlled mechanism available for automated sandbox testing?

## 3. Subscription Discovery (`CK-API-002`)

Before calling cancellation, CK must resolve the correct active car-wash subscription from the authenticated user.

- Will `GET /v1/user` remain the authoritative way to discover the user's subscriptions?
- How should CK identify the car-wash subscription when the documented `Subscriptions` array contains multiple product types or multiple active subscriptions?
- The documented states distinguish `Active` and `Cancelled`, but do not identify a subscription scheduled for cancellation. How should CK detect that condition?
- How should CK select the correct subscription when multiple active subscriptions are returned?
- Are `SubscriptionId` and `PlanId` stable across renewals, downgrades, and other plan changes?

## 4. Subscription Relationship Metadata (`CK-API-003`)

CK must distinguish an owner or primary subscriber from a family member before offering cancellation. LB must still enforce this authorization on the server.

- What are the canonical role field and values for owner or primary versus member or child?
- Will relationship metadata be included directly on every relevant subscription returned to CK?
- What should be returned for subscriptions inherited through a family relationship?
- Can a family member view the parent-owned subscription while remaining unable to cancel it?
- Are there any additional relationship states CK must handle?
- When will this metadata be available in the sandbox?

## 5. Cancellation Action and Authorization (`CK-API-004`)

The documented cancellation contract is `POST /v1/subscriptions/cancel` with an authenticated Bearer token and a numeric `subscriptionId`. A successful call returns `200 OK` without a response body. Successful cancellation has not yet been fully validated because the sandbox does not provide a resettable subscription.

- Please confirm that LB authorizes cancellation from the authenticated user context, not merely from possession of a subscription ID.
- Is cancellation restricted to the owner or primary subscriber?
- Does cancellation take effect immediately or at the next renewal date?
- The documented post-cancellation `SubscriptionState` is `Cancelled`. What `RenewalState` should appear after a successful cancellation?
- Does cancellation affect every member of a multi-user subscription?
- Because the documented success response has no body, how should CK determine whether cancellation was immediate or scheduled?
- Can a cancelled subscription be reactivated through an API or support process?
- What happens if the client retries after a timeout and the first request may already have succeeded?

## 6. Normalized Cancellation Outcomes (`CK-API-005`)

Please confirm the response contract for these required deterministic outcomes:

- `cancelled`
- `already_inactive`
- `not_owner`
- `not_found`
- `failed`

For each outcome, please provide:

- HTTP status.
- Stable machine-readable `code`.
- Numeric `errorCode`, if applicable.
- Response-body example.
- Whether the outcome is retryable.
- Whether the returned message is safe to show directly to the customer.

Please also clarify:

- Whether business outcomes are returned as successful response values, structured errors, or a combination of both.
- Whether an already-inactive cancellation is considered idempotent success or a conflict.
- Whether `failed` is reserved for unexpected technical failures.
- Whether every failure returns `detail` and `traceId` for support correlation.

## 7. Idempotency and Duplicate Protection (`CK-API-014`)

Cancellation must not be repeated if CK retries after a timeout or network interruption.

- Which header or request field will carry the idempotency key?
- What is the retention period for an idempotency key?
- Does retrying the same request return the original cancellation result?
- What happens if the same key is reused with a different subscription ID or payload?
- Which HTTP status and error code represent an idempotency conflict?
- Will duplicate protection cover the case where the original cancellation completed but its response did not reach CK?

## 8. Cancellation Audit (`CK-API-015`)

- How should CK identify itself as the source or channel of the cancellation?
- Is service identity derived from Agent API credentials or supplied in the request?
- Will the audit event include the authenticated user, subscription, operation, timestamp, outcome, source, idempotency key, and trace ID?
- Are rejected attempts such as `not_owner` and `not_found` also audited?
- Can support teams query these events when investigating a customer case?
- Which identifier should CK retain and provide during escalation?

## 9. Rate Limiting (`CK-API-016`)

- What sandbox and production rate limits will apply to cancellation?
- Are limits calculated per service, authenticated user, subscription, API key, or IP address?
- What deterministic `429` response contract will be used?
- Will `Retry-After` or an equivalent retry duration be returned?
- Will rate-limit responses include `code`, `detail`, and `traceId`?
- Can cancellation rate-limit behavior be tested safely in the sandbox?

## 10. Common Error Contract

The authentication and session documentation establishes `InvalidInput` / `1001`, `AuthenticationFailed` / `1002`, `InvalidSignature` / `1003`, `SessionInvalid` / `1004`, and `InsufficientScope` / `1005`. The remaining questions are:

- Whether `INVALID_SIGNATURE` and `InvalidSignature` represent the same condition.
- Whether `BOOTSTRAP_VALIDATION_FAILED` has a numeric `errorCode`.
- Whether cancellation-specific business failures beyond the documented `400` and `401` responses use the same Problem Details fields and include a numeric `errorCode`.
- Whether `SessionInvalid` / `1004`, `InsufficientScope` / `1005`, and cancellation-specific failures are safe to retry. The supplied guidance already establishes that `AuthenticationFailed` / `1002` should trigger one reauthentication attempt and `InvalidSignature` / `1003` should not be retried.
- Which messages are safe to present directly to customers.

## 11. Cancellation Reason (`CK-API-021`)

We understand that an optional cancellation reason is currently unsupported and deferred from V1.

Please confirm that:

- Cancellation reason is not required in the V1 request.
- Its absence will not prevent a successful cancellation.
- No cancellation-reason field should be implemented by CK until LB defines the storage and reporting contract.

The immediate requirement is a stable sandbox contract and repeatable test data for subscription discovery, owner/member identification, successful owner cancellation, deterministic non-owner handling, already-inactive handling, not-found handling, retry protection, and audit verification.

Kind regards,  
[Name / Team]
