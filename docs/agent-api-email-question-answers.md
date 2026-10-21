# Agent API Clarification and Sandbox: Question-and-Answer Reference

**Conversation period:** September 30–October 14, 2026  
**Question sender:** Matīss Zilgalvis, Circle K  
**Answer sender:** Lamont Toney, Liquid Barcodes (LB)  
**Source:** `Re_ Agent API clarification and sandbox.msg`  
**Scope:** Subscription discovery, ownership, cancellation, testing, errors, retries, audit, and rate limiting

> **Sensitive sandbox data:** This document intentionally includes the test phone numbers, subscription IDs, and SSO tokens supplied in the email. Treat them as credentials even though they are for sandbox use.

## Latest Sandbox Test Data

Authenticate each customer through `POST /v1/auth/sso` with the corresponding SSO test token. A PIN or fixed OTP is not required.

| Phone | Role | Subscription | SSO token | Intended test |
|---|---|---:|---|---|
| `1-222-333 3333` | Owner of a multi-user car-wash plan | `108544` | `12223333333token` | Successful cancellation |
| `1-444-555 5555` | Family member (`Child`) on the owner's plan | `108544` | `14445555555token` | Shared-subscription view; cancellation rejected as not owner (`403` / `91`) |
| `1-666-777 7777` | Unrelated user who owns an already-cancelled plan | `108545` | `16667777777token` | Cancellation of `108544` rejected as not owner (`403` / `91`); repeated cancellation of `108545` returns `200` with no state change |

Use a nonexistent subscription ID such as `99999` for the not-found case (`404` / `90`).

### Reset procedure

Resets are manual. After cancelling subscription `108544`, reply to Lamont's email and ask LB to restore it before testing another successful cancellation. Subscription `108545` is already cancelled and will disappear from `GET /v1/user` when its current period ends. Ask LB for a replacement if that happens.

---

## 1. Sandbox and Test Data

### Q1.1 — Can the sandbox provide an authenticated owner with an active, cancellable car-wash subscription?

**Status: Answered.** Yes. Phone `1-222-333 3333`, authenticated with SSO token `12223333333token`, owns active multi-user car-wash subscription `108544`. It is reserved for successful-cancellation testing.

### Q1.2 — Can the sandbox provide a family member with access to a parent-owned subscription?

**Status: Answered.** Yes. Phone `1-444-555 5555`, authenticated with SSO token `14445555555token`, is a `Child` on subscription `108544`. The account can view the shared subscription but cannot cancel it.

### Q1.3 — Can the sandbox provide an inactive or already-cancelled subscription?

**Status: Answered.** Yes. Phone `1-666-777 7777`, authenticated with SSO token `16667777777token`, owns already-cancelled subscription `108545`. Repeating cancellation returns `200` and makes no change.

### Q1.4 — Can the sandbox provide a subscription ID that does not exist?

**Status: Answered.** Use any nonexistent ID, for example `99999`. Cancellation should return `404`, code `SubscriptionNotFound`, error code `90`.

### Q1.5 — Is there a repeatable way to restore or recreate the active subscription after cancellation?

**Status: Partially answered.** LB can manually restore subscription `108544` while it is within its current period. After cancelling it, reply to the email and request restoration. No self-service or automated reset was provided, and no reset turnaround time was stated.

### Q1.6 — May cancellation tests run automatically, or do they require prior approval?

**Status: Open.** The latest follow-up says confirmation on whether automated tests can run against the reserved accounts without prior approval will follow. Until then, the email does not authorize unattended or repeated state-changing tests.

### Q1.7 — How should test data be reset after a successful cancellation?

**Status: Answered.** Reset is manual. Reply to LB after cancelling subscription `108544`, and LB will restore it. The email does not state a service-level or turnaround time.

### Q1.8 — Can stable test identities and subscriptions be reserved for CK integration testing?

**Status: Answered.** Yes. LB supplied the three stable identities and subscriptions listed under [Latest Sandbox Test Data](#latest-sandbox-test-data). The already-cancelled subscription `108545` is only stable until its current period ends, after which it drops out of `GET /v1/user`; LB can provide a replacement if needed.

### Q1.9 — Do sandbox authentication, authorization, and cancellation behaviors match the intended production contract?

**Status: Answered with release caveat.** LB stated that the described cancellation and authorization behavior matches sandbox testing. On October 12, LB said the cancellation error responses in section 6 were in final testing and would be in production with that release. The thread does not identify the production release or independently confirm its deployment.

### Q1.10 — Is a manual reset available if automatic reset is impossible, and what is its expected turnaround time?

**Status: Partially answered.** Manual reset is available by replying to LB. The expected turnaround time remains unspecified.

---

## 2. Authentication and User Context (CK-API-001)

### Q2.1 — Is a fixed OTP or another controlled mechanism available for automated sandbox testing?

**Status: Answered; original fixed-OTP question superseded.** Each reserved test customer has an SSO test token. Authenticate through `POST /v1/auth/sso` without a PIN. This mechanism works for automated tests and replaces the fixed OTP that LB had been investigating.

The supplied tokens are:

- Owner: `12223333333token`
- Child/family member: `14445555555token`
- Unrelated user/already-cancelled owner: `16667777777token`

Subsequent Agent API calls use the resulting access token. The cancellation request needs that token and a numeric `subscriptionId`; it does not require a device ID.

---

## 3. Subscription Discovery (CK-API-002)

### Q3.1 — Will `GET /v1/user` remain the authoritative way to discover a user's subscriptions?

**Status: Answered.** Yes. `GET /v1/user` is the authoritative source for the user's subscriptions and their current state.

### Q3.2 — How should CK identify the car-wash subscription when multiple product types or multiple active subscriptions are returned?

**Status: Partially answered.** The subscription response has no product-type field. LB advised identifying car-wash subscriptions by `planId`, or by `planName`. LB said the car-wash plan IDs could be shared as part of the test data, but the thread does not contain the plan-ID allowlist.

### Q3.3 — How should CK detect a subscription scheduled for cancellation?

**Status: Answered.** After cancellation, `GET /v1/user` immediately reports `subscriptionState: "Cancelled"`; `renewalDate` gives the date on which the subscription ends. A present subscription with state `Cancelled` and a renewal date represents scheduled cancellation. Once it has ended, it no longer appears in the list.

### Q3.4 — How should CK select the correct subscription when multiple active subscriptions are returned?

**Status: Partially answered.** Filter by the applicable car-wash `planId`, or use `planName` where necessary, and use the current record returned by `GET /v1/user`. The thread does not define tie-breaking behavior if multiple matching active car-wash subscriptions remain after that filtering.

### Q3.5 — Are `subscriptionId` and `planId` stable across renewals, downgrades, and other plan changes?

**Status: Partially answered.** `subscriptionId` remains the same across regular renewals. An upgrade or a downgrade at renewal creates a new subscription with a new `subscriptionId`, and the old subscription is retired. CK must always read the current ID from `GET /v1/user` rather than store it long term. The email does not explicitly describe `planId` stability across these changes.

---

## 4. Subscription Relationship Metadata (CK-API-003)

### Q4.1 — What are the canonical role field and values for owner or primary versus member or child?

**Status: Answered.** The canonical field is `role`. Its only values are `Owner` and `Child`.

### Q4.2 — Is relationship metadata included directly on every relevant subscription returned to CK?

**Status: Answered.** Each subscription carries the `role` field. This metadata was available in sandbox at the time of LB's October 12 response.

### Q4.3 — What is returned for subscriptions inherited through a family relationship?

**Status: Answered.** A user's own subscriptions appear in `subscriptions`. A subscription inherited through a family relationship appears in the separate `sharedSubscriptions` list with `role: "Child"`.

### Q4.4 — Can a family member view the parent-owned subscription while remaining unable to cancel it?

**Status: Answered.** Yes. A child can view the subscription in `sharedSubscriptions`, but only the owner can cancel it. Attempting cancellation as the supplied child account should return `403`, code `InvalidSubscriptionMemberId`, error code `91`.

### Q4.5 — Are there additional relationship states CK must handle?

**Status: Answered.** No. LB said there are no relationship states beyond `Owner` and `Child`.

### Q4.6 — When will this metadata be available in sandbox?

**Status: Answered.** It was already available in sandbox as of the October 12 response.

---

## 5. Cancellation Action and Authorization (CK-API-004)

### Q5.1 — Does LB authorize cancellation from the authenticated user context rather than possession of a subscription ID?

**Status: Answered.** Yes. LB authorizes cancellation using the authenticated user behind the access token. Knowing a valid subscription ID is insufficient.

### Q5.2 — Is cancellation restricted to the owner or primary subscriber?

**Status: Answered.** Yes. Only a user whose subscription role is `Owner` may cancel.

### Q5.3 — Does cancellation take effect immediately or at the next renewal date?

**Status: Answered.** Normally, cancellation takes effect at the end of the current billing period on the next renewal date. It ends immediately in two cases:

1. A delayed-start subscription has not yet activated.
2. A subscription is in the middle of renewing.

### Q5.4 — What `renewalState` appears after successful cancellation?

**Status: Answered.** Cancellation does not change `renewalState`. CK must rely on `subscriptionState`, which becomes `Cancelled` immediately, and on `renewalDate`, which indicates when the subscription ends.

### Q5.5 — With an empty success response, how can CK determine whether cancellation was immediate or scheduled?

**Status: Answered.** Read `GET /v1/user` after cancellation:

- If the subscription is present with `subscriptionState: "Cancelled"` and a `renewalDate`, cancellation is scheduled for that date.
- If the subscription has disappeared, it has already ended.

### Q5.6 — Can a cancelled subscription be reactivated through an API or support process?

**Status: Answered.** A customer can restart a cancelled subscription through the app until its current period ends. Restart is not available through Agent API. For reserved sandbox subscription `108544`, LB offers a manual reset after an email request.

### Q5.7 — What happens if the client retries after a timeout when the first cancellation might already have succeeded?

**Status: Answered.** The endpoint is idempotent by state: cancelling an already-cancelled subscription returns `200` and makes no further change. Nevertheless, LB recommends calling `GET /v1/user` first after a timeout and resending only if the subscription is still present and is not `Cancelled`.

---

## 6. Normalized Cancellation Outcomes (CK-API-005)

Failures use structured Problem Details with `status`, `detail`, `code`, numeric `errorCode`, `instance`, and `traceId`. Success has an empty body.

| Requested outcome | HTTP | Stable `code` | `errorCode` | Body/behavior | Retry guidance | Customer display guidance |
|---|---:|---|---:|---|---|---|
| `cancelled` | `200` | None | None | Empty body | Verify with `GET /v1/user`; no ordinary retry needed | Use CK confirmation wording |
| `already_inactive` (already cancelled or ended) | `200` | None | None | Empty body; treated as success, not conflict; no state change | No retry required | Use CK confirmation wording |
| `not_owner` | `403` | `InvalidSubscriptionMemberId` | `91` | Problem Details | Do not retry | Select CK wording from `code`; do not expose provider `detail` directly |
| `not_found` | `404` | `SubscriptionNotFound` | `90` | Problem Details | Do not retry | Select CK wording from `code`; do not expose provider `detail` directly |
| `failed` — unexpected LB error | `500` | `UnexpectedError` | `1009` | Problem Details | Check `GET /v1/user` before deciding whether to retry | Use generic CK failure wording |
| `failed` — downstream unavailable | `502` | `DependencyError` | `1008` | Problem Details | Check `GET /v1/user` before deciding whether to retry | Use generic CK temporary-failure wording |

### Q6.1 — Are business outcomes successful values, structured errors, or both?

**Status: Answered.** Both. Successful cancellation and already-inactive cancellation return `200` with an empty body. Not-owner, not-found, and technical failures return structured Problem Details errors.

### Q6.2 — Is already-inactive cancellation idempotent success or a conflict?

**Status: Answered.** It is idempotent success: `200`, empty body, and no state change.

### Q6.3 — Is `failed` reserved for unexpected technical failures?

**Status: Answered.** Yes. LB identified `UnexpectedError` / `1009` and downstream `DependencyError` / `1008` as technical failures.

### Q6.4 — Does every failure return `detail` and `traceId` for support correlation?

**Status: Answered.** LB stated that failures use Problem Details containing `status`, `detail`, `code`, numeric `errorCode`, `instance`, and `traceId`.

### Q6.5 — Are returned error messages safe to show directly to the customer?

**Status: Answered with recommendation.** LB said details are generic and contain no plan details, but recommended that the chatbot choose its own customer-facing wording from the stable `code` instead of showing `detail` directly.

### Example supplied for `not_owner`

```json
{
  "status": 403,
  "detail": "Only the subscription owner can perform this action.",
  "code": "InvalidSubscriptionMemberId",
  "errorCode": 91,
  "traceId": "00-…"
}
```

The source example omits `instance`, although LB's general contract says failures include it.

---

## 7. Idempotency and Duplicate Protection (CK-API-014)

### Q7.1 — Which header or request field carries the idempotency key?

**Status: Not applicable.** The cancellation endpoint does not accept an idempotency key.

### Q7.2 — What is the retention period for an idempotency key?

**Status: Not applicable.** There is no idempotency key.

### Q7.3 — Does retrying the same request return the original cancellation result?

**Status: Answered by state behavior.** LB did not describe replaying a stored original response. Instead, a repeated cancellation against an already-cancelled subscription returns a fresh `200` and leaves the state unchanged.

### Q7.4 — What happens if the same key is reused with a different subscription ID or payload?

**Status: Not applicable.** There is no key to reuse.

### Q7.5 — Which HTTP status and error code represent an idempotency conflict?

**Status: Not applicable.** There is no key-conflict response. Repeated cancellation of an already-cancelled subscription returns `200`.

### Q7.6 — Does duplicate protection cover a completed cancellation whose response did not reach CK?

**Status: Answered.** Yes, through idempotent state handling. A repeated request returns `200` without cancelling twice or failing. LB still recommends checking `GET /v1/user` before resending.

### Timeout recovery sequence

1. Call `GET /v1/user`.
2. If the subscription is present with `subscriptionState: "Cancelled"`, treat the cancellation as successful and do not resend.
3. If the subscription has disappeared, treat it as ended and do not resend.
4. Resend only if the current subscription remains present and is not `Cancelled`.

---

## 8. Cancellation Audit (CK-API-015)

### Q8.1 — How should CK identify itself as the cancellation source or channel?

**Status: Answered.** CK does not send a separate source field. LB identifies the chatbot from its Agent API credentials, specifically `CustomerAuthConfigId`.

### Q8.2 — Is service identity derived from Agent API credentials or supplied in the request?

**Status: Answered.** It is derived from Agent API credentials, not supplied in the cancellation request.

### Q8.3 — What does the audit event include?

**Status: Answered.** Every event records:

- Trace ID
- UTC timestamp
- Operation, including method and path
- Customer and member
- HTTP status and error code
- Duration
- Client IP and user agent
- Session hash
- Calling integration

There is no idempotency-key field because cancellation does not use an idempotency key. LB did not explicitly say that the subscription ID is a separately queryable audit field, although customer/member and operation are recorded.

### Q8.4 — Are rejected attempts such as `not_owner` and `not_found` audited?

**Status: Answered.** Yes. LB audits every request, including rejected attempts.

### Q8.5 — Can support teams query these events during customer investigations?

**Status: Partially answered.** LB identified `GET /v1/audit-events` with lookup by user ID or phone number. The endpoint was still in testing when LB responded, so its production availability is not confirmed by the thread.

### Q8.6 — Which identifier should CK retain for escalation?

**Status: Answered.** Retain and provide `traceId`.

---

## 9. Rate Limiting (CK-API-016)

### Q9.1 — What sandbox and production rate limits apply to cancellation?

**Status: Open.** No Agent API rate limits were configured when LB replied. LB requested CK's expected peak and concurrent request volumes before defining sandbox and production limits.

### Q9.2 — Are limits calculated per service, authenticated user, subscription, API key, or IP address?

**Status: Open.** LB said counting rules would be defined after CK supplied expected volumes.

### Q9.3 — What deterministic `429` response contract will be used?

**Status: Open.** LB said it would define the `429` contract after receiving traffic expectations.

### Q9.4 — Will `Retry-After` or an equivalent duration be returned?

**Status: Planned but not finalized.** LB said the future `429` response would include a retry duration, but did not specify the field, semantics, or value format.

### Q9.5 — Will rate-limit responses include `code`, `detail`, and `traceId`?

**Status: Planned but not finalized.** LB said the future response would include the standard `code`, `detail`, and `traceId` fields. No exact code or complete example was supplied.

### Q9.6 — Can cancellation rate-limit behavior be tested safely in sandbox?

**Status: Open.** No limits currently exist, and the thread gives no approved sandbox rate-limit test procedure.

### Action requested from CK

Provide expected peak request rate and concurrent request volume so LB can define limits, counting scope, and deterministic `429` behavior.

---

## 10. Common Error Contract

### Q10.1 — Do `INVALID_SIGNATURE` and `InvalidSignature` represent the same condition?

**Status: Answered.** Yes. The canonical code is `InvalidSignature` with numeric error code `1003`. `INVALID_SIGNATURE` was an outdated spelling.

### Q10.2 — Does `BOOTSTRAP_VALIDATION_FAILED` have a numeric `errorCode`?

**Status: Answered; premise superseded.** `BOOTSTRAP_VALIDATION_FAILED` is not a separate code. Bootstrap failures return `AuthenticationFailed` with numeric error code `1002`.

### Q10.3 — Do cancellation-specific business failures use the same Problem Details fields and numeric `errorCode`?

**Status: Answered.** Yes. They use the common Problem Details shape and include a numeric `errorCode`.

### Q10.4 — Which errors are safe to retry?

**Status: Answered.** The thread establishes the following guidance:

| Condition | HTTP | Numeric code | Retry guidance |
|---|---:|---:|---|
| `InvalidInput` | Typically `400` | `1001` | No explicit retry guidance in this thread; correct the input before another request |
| `AuthenticationFailed` | Authentication failure | `1002` | Trigger one reauthentication attempt, per the guidance quoted in the original question |
| `InvalidSignature` | Signature failure | `1003` | Do not retry |
| `SessionInvalid` | `401` | `1004` | Reauthenticate once to obtain a new session, then retry once |
| `InsufficientScope` | `403` | `1005` | Do not retry; the session lacks permission and this is a configuration issue |
| `InvalidSubscriptionMemberId` | `403` | `91` | Do not retry |
| `SubscriptionNotFound` | `404` | `90` | Do not retry |
| `UnexpectedError` | `500` | `1009` | Check `GET /v1/user` before retrying cancellation |
| `DependencyError` | `502` | `1008` | Check `GET /v1/user` before retrying cancellation |

The latest follow-up resolves the October 12 open point for `SessionInvalid` and `InsufficientScope`.

---

## 11. Cancellation Reason (CK-API-021)

### Q11.1 — Is a cancellation reason required in the V1 request?

**Status: Answered.** No. Cancellation reason is not required in V1.

### Q11.2 — Will absence of a cancellation reason prevent successful cancellation?

**Status: Answered.** No. Its absence does not prevent cancellation.

### Q11.3 — Should CK implement a cancellation-reason field before LB defines storage and reporting?

**Status: Answered.** No. CK should not implement the field until LB defines its storage and reporting contract.

---

## Consolidated Remaining Open or Partial Items

| Item | Status from thread | Impact/next step |
|---|---|---|
| Approval requirement for automated tests against reserved accounts | Open; explicitly the remaining point in the latest follow-up | Obtain LB confirmation before unattended or repeated state-changing tests |
| Manual reset turnaround time | Not stated | Agree an expected response time with LB for repeatable test execution |
| Final car-wash `planId` list | Promised/shareable but absent from thread | Obtain the allowlist before relying exclusively on `planId` |
| Selection when multiple matching active car-wash subscriptions remain | Not defined | Request a deterministic tie-break rule if this state is possible |
| `planId` stability across plan changes | Not explicitly answered | Confirm if implementation depends on long-lived plan identifiers |
| Production release of final cancellation errors | October 12 response said final testing and upcoming release; deployment not confirmed | Confirm deployed API version before production validation |
| Audit-event endpoint availability | `GET /v1/audit-events` was in testing | Confirm availability and access contract |
| Subscription ID as a distinct audit-event field | Not explicitly stated | Confirm if support requires direct subscription lookup |
| Rate limits, counting scope, exact `429` code, and test procedure | Open pending CK traffic figures | CK supplies peak/concurrency expectations; LB defines contract |

## Resolved Since the October 12 Response

- Fixed OTP is no longer needed; SSO tokens are available for all reserved accounts.
- Reset is confirmed as manual.
- `SessionInvalid` / `1004`: reauthenticate once, then retry once.
- `InsufficientScope` / `1005`: do not retry; correct session/application permissions.
- Concrete owner, child, unrelated-user, already-cancelled, and not-found test data is available.

## Contact Details Present in the Thread

- **Liquid Barcodes:** Lamont Toney — `lamont.toney@liquidbarcodes.com`
- **Circle K:** Matīss Zilgalvis — `matiss.zilgalvis@circlekeurope.com`, `+371 29720708`
