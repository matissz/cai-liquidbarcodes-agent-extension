# Liquid Barcodes: Additional Use Cases and App API Environment Questions

**Subject:** App API access and clarification for deferred car-wash support scenarios

Hi Liquid Barcodes team,

The current delivery is focused on subscription cancellation. The questions below cover the additional scenarios that are outside that immediate scope: too many devices or device reset, exceeded wash or a single wash code, equipment down or a failed wash, and rebate.

Some of these capabilities are not present in the Agent API documentation currently available to us. Our preference is to use the Agent API wherever the required operation is or will become available. Where LB confirms that a scenario depends on the App API, we need the environment and contract details below before implementation and end-to-end testing can begin.

## 1. API Ownership and Roadmap

For each scenario, please confirm whether the required capability:

- Is already available through the Agent API.
- Is planned for the Agent API and, if so, under which roadmap item and expected contract.
- Must be implemented through the App API.
- Must remain a manual customer-support process because no supported API operation exists.

Please also identify which system is authoritative for eligibility, execution, and final status. We do not want CK to infer business eligibility or perform an App API operation when LB expects the Agent API to own it.

## 2. App API Environment Requirements

If any of the scenarios require the App API, please provide a non-production environment that supports the relevant read and write operations. We need:

- The sandbox or QA base URL and API version.
- Current OpenAPI documentation or equivalent request and response specifications.
- The authentication and request-signing method, including token lifetime and renewal behavior.
- Dedicated CK client credentials with only the scopes required for the agreed scenarios.
- Any tenant, market, brand, or company identifiers required with each request.
- Network restrictions, IP allowlisting, TLS requirements, and certificate requirements.
- Sandbox and production rate limits, including the deterministic `429` response and retry guidance.
- Confirmation of response casing, date/time format, locale behavior, and identifier formats.
- Stable machine-readable error codes, HTTP statuses, customer-safe messages, and trace or correlation IDs.
- Idempotency support for every state-changing operation.
- Audit behavior and the identifier CK should retain for support escalation.

The environment must provide controlled test data for:

- An authenticated user with registered devices that can be reset and restored.
- A user who is below and above the configured device limit.
- A user eligible and ineligible for a one-time wash code.
- A subscription that has reached its wash allowance.
- Completed, failed, and missing wash transactions.
- Stores and machines in `Available`, `OutOfService`, and `Offline` states.
- A user or transaction eligible and ineligible for a rebate.

For repeatable automation, please confirm:

- How each fixture is reset after a state-changing test.
- Whether stable test identities, subscriptions, machines, and transactions can be reserved for CK.
- Which tests may run automatically and which require prior approval.
- Whether environment behavior and error contracts match the intended production behavior.
- The manual reset process and expected turnaround time when automatic reset is unavailable.
- Whether Agent API and App API identifiers refer to the same users, subscriptions, stores, machines, coupons, and transactions.

No App API credentials or test data should be sent by email. Please provide them through the agreed secure channel.

## 3. Too Many Devices and Device Reset

The current Agent API user model may expose a `DeviceId`, but the available documentation does not define device inventory, device-limit status, or a reset operation.

- What exactly counts as a registered device and what triggers the "too many devices" condition?
- Is the limit applied per user, subscription, household, market, or application?
- Which API returns the registered-device count, device list, configured limit, and remaining capacity?
- Is a device identifier safe to present to a customer, or will LB return a masked display name and last-used timestamp?
- Which operation resets all registered devices, and is removal of one selected device also supported?
- Does reset revoke active access tokens, SSO bindings, refresh tokens, or only activation registrations?
- Must the customer reauthenticate or register the current device after reset?
- What verification and authorization are required before CK may perform a reset?
- Can a family member reset devices, or is the operation restricted to the account owner?
- Is there a cooldown, frequency limit, or maximum number of self-service resets?
- What deterministic outcomes represent `reset_completed`, `no_devices`, `not_authorized`, `cooldown_active`, and `failed`?
- Is the operation idempotent when CK retries after a timeout?
- How is the reset audited, and which trace or operation ID should CK retain?

Please provide test fixtures for a user below the limit, a user at or above the limit, a user in cooldown, and a user not authorized to reset the account.

## 4. Exceeded Wash Allowance and Single Wash Code

The Agent API currently documents `POST /v1/coupons/issue`, which accepts a Liquid Barcodes-provided `scheduleId`, optional `expirationDate`, and optional `transactionId`. Its documented success response is `200 OK` without the issued coupon or wash code.

- Is coupon issuance the supported operation for granting a one-time wash after a customer reaches the subscription allowance?
- What authoritative data tells CK that the allowance has been reached, including the limit, usage, reset date, and applicable subscription?
- Which `scheduleId` must be used in each market or brand for a single car wash?
- Is eligibility enforced by LB before issuance, or must CK determine eligibility?
- Can family members receive a code, and does issuance affect the owner's allowance or account?
- Does the operation generate a human-readable code, a barcode, a coupon ID, or another redeemable token?
- How does CK retrieve the issued code when the issue response contains no body?
- What are the validity period, eligible stores, eligible wash programs, and redemption limits?
- Can an issued but unused code be revoked or replaced?
- How can CK determine whether the code was issued, delivered, redeemed, expired, or cancelled?
- What should `transactionId` represent, and must it be globally unique?
- What idempotency guarantee prevents duplicate codes when CK retries after a timeout?
- What deterministic outcomes represent `issued`, `not_eligible`, `allowance_not_exceeded`, `already_issued`, `schedule_not_found`, and `failed`?

Please provide a sandbox schedule, a resettable eligible user, and a way to inspect or simulate code redemption without consuming production inventory.

## 5. Equipment Down, Malfunction, or Unable to Get a Wash

The Agent API currently exposes `GET /v1/stores/machines/status` with store and machine states such as `Available`, `OutOfService`, and `Offline`. It does not document an operation for reporting a failed wash, validating an attempted activation, or issuing remediation.

- Are machine statuses real time, and what delay or staleness should CK expect?
- Does `Available` guarantee that a wash can be started, or only that the machine is online?
- What are all supported machine states and customer-safe explanations for each state?
- How should CK distinguish a store-wide outage from one unavailable machine?
- Which identifier should the customer or CK provide: `StoreId`, `StoreMachineId`, `MachineDeviceId`, activation code, receipt ID, or transaction ID?
- Which API returns the attempted wash or activation outcome and its timestamp?
- How should CK determine whether a wash entitlement or code was consumed when the equipment failed?
- Is there a supported operation to report the malfunction or open a support case?
- Which operation provides remediation: restore the entitlement, reissue a wash code, apply a rebate, initiate a refund, or route to manual support?
- What evidence and time window are required before automated remediation is allowed?
- How are duplicate malfunction reports and repeated remediation requests prevented?
- Can the sandbox simulate `OutOfService`, `Offline`, activation failure, and a wash consumed without successful service?
- What deterministic outcomes and error codes should CK use to choose between retrying, offering another store, issuing remediation, and escalating to support?

Please confirm whether the machine-status endpoint may be polled, whether `lastUpdateTime` is intended for incremental updates, and what polling frequency is permitted.

## 6. Rebate

The available Agent API documentation exposes renewal-price information that may account for rebates, but it does not define rebate eligibility, creation, approval, or status operations.

- What does "rebate" mean in this use case: subscription credit, payment-method credit, coupon, price adjustment, or another benefit?
- Which events can make a customer eligible, such as a failed wash, outage, service complaint, or exceeded allowance?
- Which API is authoritative for eligibility and the maximum permitted amount or benefit?
- May CK apply a rebate directly, or may it only submit a request for review?
- What customer verification, evidence, transaction reference, store, machine, and reason are required?
- Does the operation require a predefined reason code rather than free text?
- Which currencies, markets, taxes, and rounding rules apply?
- Where is the rebate applied, and when does it become visible to the customer?
- How can CK retrieve the final status and communicate pending, approved, rejected, applied, or reversed outcomes?
- Can an approved rebate be reversed, and who is authorized to do so?
- What limits apply per incident, user, subscription, and time period?
- What idempotency key or case reference prevents duplicate rebates?
- What deterministic outcomes represent `applied`, `pending_review`, `not_eligible`, `limit_exceeded`, `duplicate`, `not_authorized`, and `failed`?
- How are rebate requests and decisions audited for customer support and financial reconciliation?

Please provide sandbox fixtures for automatic approval, manual review, rejection, duplicate submission, and limit-exceeded behavior without creating a real financial movement.

## 7. Shared Response and Error Contract

For every endpoint needed by these scenarios, please provide:

- A successful request and response example.
- Every expected business outcome with its HTTP status and stable machine-readable code.
- Validation, authentication, authorization, not-found, conflict, rate-limit, and unexpected-failure examples.
- A clear distinction between retryable technical failures and final business outcomes.
- Confirmation that each error includes `status`, `code`, `detail`, and `traceId`, plus numeric `errorCode` where applicable.
- Confirmation of which messages are safe to display directly to customers.

## 8. Requested Next Step

For each of the four scenarios, please identify the owning API and provide the relevant contract or roadmap reference. Where App API is required, the immediate dependency is environment access, scoped credentials, controlled fixtures, reset procedures, and complete response examples.

Once those details are available, CK can confirm implementation scope and prepare independent end-to-end tests for each supported scenario.

Kind regards,  
[Name / Team]
