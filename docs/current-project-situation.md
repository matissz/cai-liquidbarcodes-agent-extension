# Current Project Situation

**Last updated:** October 21, 2026
**Current extension version:** 1.2.4

## Overview

The Liquid Barcodes Cognigy extension is under active development and is subject to frequent changes. Requirements, API contracts, integration behavior, and test-environment capabilities are still evolving. For this reason, planning the entire end-to-end development effort in detail is currently neither practical nor reliable.

Development will proceed incrementally, with scope reviewed as decisions are confirmed.

## Current Milestone

The next milestone is to develop and validate the extension so that it satisfies the **Cancel Subscription** use case.

The extension currently includes a Cancel Subscription node that:

- Sends `POST /v1/subscriptions/cancel` with an authenticated user token and numeric subscription ID.
- Signs the request according to the currently documented Liquid Barcodes API contract.
- Stores successful and unsuccessful outcomes in Cognigy context.
- Routes execution through success and error child branches.
- Produces diagnostic logs without exposing credentials.
- Is covered by automated unit tests.
- Emits normalized outcomes and flow directives, including bounded one-time reauthentication,
  deterministic no-retry results, and state verification before retrying uncertain writes.
- Requires a fresh Get User Profile verification after every successful cancellation response.

All existing source API nodes now use the common error envelope and clear stale shared error state after success. User types preserve owner/child roles plus owned and shared subscription collections. Dormant source nodes have not been newly exposed by the extension module.

The complete cancellation journey must cover more than the API call itself. It depends on correctly authenticating the customer, identifying the relevant subscription, determining whether the customer is authorized to cancel it, handling deterministic cancellation outcomes, and validating the result against suitable sandbox data.

## Current Validation Status

The repository is currently healthy at the code level:

- The project builds successfully.
- All 22 automated test suites pass.
- All 259 automated tests pass.
- The working branch is synchronized with its remote branch.

Automated tests confirm the extension's behavior against the previously understood contract. LB has now supplied reserved sandbox identities and SSO test tokens for the required cancellation scenarios, but successful end-to-end cancellation has not yet been recorded. The active test subscription also requires a manual LB reset after cancellation. Passing unit tests therefore does not yet represent final acceptance of the complete cancellation flow.

## Confirmed Decisions and Remaining Dependencies

The October 2026 email exchange resolved most cancellation-contract questions:

- `GET /v1/user` is authoritative for current subscription discovery.
- Owned subscriptions and family-inherited `sharedSubscriptions` use the roles `Owner` and `Child`.
- LB authorizes cancellation from the authenticated user, and only the owner may cancel.
- Cancellation normally applies at period end; state must be verified afterward through `GET /v1/user`.
- Already-cancelled cancellation is an idempotent `200`; no idempotency key is supported.
- Deterministic not-owner, not-found, session, permission, dependency, and unexpected-error contracts are defined.
- Sandbox SSO tokens replace the need for fixed OTP test automation.
- Cancellation reason and Agent API reactivation are outside V1 scope.

Remaining external dependencies are:

- LB confirmation that automated state-changing tests may run without prior approval.
- Manual LB reset after successful cancellation and a predictable reset turnaround time.
- A final car-wash `planId` allowlist for production subscription selection.
- CK request-volume estimates before LB defines rate limits and the `429` contract.
- Release availability of `GET /v1/audit-events`, which is still in testing.

The readable decision record is [agent-api-cancellation-email-summary.md](./agent-api-cancellation-email-summary.md). The implementation and validation sequence is maintained in [cancel-subscription-integration-plan.md](./cancel-subscription-integration-plan.md). The original question set remains in [lb-cancellation-path-open-questions.md](./lb-cancellation-path-open-questions.md) as historical context.

## Planning Approach

The project will use milestone-based, incremental planning rather than a fixed end-to-end plan:

1. Confirm the smallest required cancellation contract and acceptance criteria.
2. Update the extension to match confirmed decisions.
3. Maintain automated coverage for the agreed behavior.
4. Validate the cancellation journey with controlled sandbox data.
5. Address findings from end-to-end validation.
6. Review and define the next milestone only after cancellation behavior is accepted.

This approach reduces rework while the external API contract and business decisions remain in motion.

## Milestone Completion Criteria

The Cancel Subscription milestone can be considered complete when:

- The authenticated customer can reach the cancellation flow through Cognigy.
- The correct cancellable subscription can be identified.
- Unauthorized users, including applicable family-member scenarios, are handled correctly.
- The extension submits a contract-compliant cancellation request.
- Success and defined failure outcomes are mapped predictably in Cognigy.
- Duplicate or uncertain requests are handled through post-action state verification and LB's idempotent repeat-cancellation behavior.
- Automated tests cover the confirmed contract.
- A successful cancellation and required failure scenarios are validated end to end in the sandbox.
- Relevant stakeholders accept the demonstrated behavior.

## Scope Beyond the Current Milestone

Other extension features and broader operational work remain relevant, but they are not the immediate planning focus. Their priority and implementation may be affected by the decisions currently being made. Detailed planning for subsequent functionality should therefore wait until the Cancel Subscription milestone and its dependencies are sufficiently stable.
