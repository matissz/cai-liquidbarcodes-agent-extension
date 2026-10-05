# Cognigy Flow Setup Guide for Liquid Barcodes Agent

This guide consolidates the implementation details and sandbox findings verified while configuring and testing version `1.0.4` of the Liquid Barcodes Agent extension. It is intended for Cognigy flow builders who need to know exactly which values each node requires, where those values come from, and which context paths to use afterward.

> Never paste real API keys, signature salts, access tokens, SSO tokens, or OTP codes into documentation, Say nodes, or logs. The examples below use placeholders.

## 1. Important Findings

1. The live sandbox returns response properties in **camelCase**, although older API examples use PascalCase.
2. Authentication nodes normalize their output to camelCase, such as `accessToken` and `expiresInSeconds`.
3. Read nodes store the Liquid Barcodes response body unchanged. Use the property names visible in the Cognigy context. For the live sandbox, use camelCase paths.
4. Every API node provides built-in **On Success** and **On Error** children. It also stores its response or normalized error in the configured context destination before routing.
5. A `subscriptionId` identifies the whole subscription. A subscription member `id` identifies one member. They are not interchangeable.
6. Adding or removing members requires the **subscription owner's access token** and a multi-user subscription.
7. Cancel Subscription cancels the whole subscription and affects the owner and all members. The current extension has no reactivation operation.
8. Version `1.0.4` adds safe request diagnostics and camelCase compatibility without changing node types or field keys, so existing node configurations should remain compatible when the extension is updated.

## 2. Connection Setup

Create one Cognigy connection of type **Liquid Barcodes Agent API**. Select this same connection in every extension node.

| Connection field | Value to provide | Source | Common mistake |
| --- | --- | --- | --- |
| `baseUrl` | Agent API base URL, without an endpoint path | Liquid Barcodes environment configuration; sandbox example: `https://agent.api.sandbox.eu1.l-b.dev` | Using the App API URL or mixing sandbox and production values |
| `apiKey` | Agent API customer API key | Liquid Barcodes | Using the signature salt as the API key |
| `signatureSalt` | Agent API request-signing secret | Liquid Barcodes | Using `appSecretKey`, including quotes, or using a salt from another environment |
| `appBaseUrl` | App API base URL | Liquid Barcodes environment configuration | Using `baseUrl`; this field is used by Request SSO Token |
| `appSecretKey` | App API request-signing secret | Liquid Barcodes | Using `signatureSalt`; these are separate secrets |

Paste all values exactly as supplied. Leading and trailing whitespace is trimmed by the extension, but quotes or embedded line breaks are still incorrect. A wrong Agent API salt normally produces HTTP `401` with `INVALID_SIGNATURE` on Agent API nodes.

## 3. Values Reused Across Nodes

Keep the default **Store Result In** values unless the flow has a specific reason to change them. The default expressions in later nodes depend on these locations.

| Value | Recommended expression | Where it comes from |
| --- | --- | --- |
| Access token | `{{context.liquidBarcodesAgent.session.accessToken}}` | Exchange SSO Token or Verify OTP |
| SSO token | `{{context.liquidBarcodesAgent.ssoToken.token}}` | Request SSO Token |
| User ID | `{{context.liquidBarcodesAgent.user.userId}}` | Get User Profile in the live camelCase response |
| Subscription ID | `{{context.liquidBarcodesAgent.user.subscriptions[0].subscriptionId}}` | A selected subscription from Get User Profile |
| Store ID | `{{context.liquidBarcodesAgent.stores.stores[0].id}}` | A selected store from Get Stores |
| Subscription member ID | `{{context.liquidBarcodesAgent.subscriptionUsers.subscriptionUsers[0].id}}` or the matching member collection path visible in context | A selected member from Get Subscription Users |
| OTP phone | `{{context.liquidBarcodesAgent.otpStart.phone}}` | Start OTP |

Do not always select array item `[0]` in a production flow. Present the available subscriptions, stores, or members to the user, then pass the ID from the selected item.

### Response casing

The live sandbox examples observed during testing use paths such as:

```text
{{context.liquidBarcodesAgent.user.userId}}
{{context.liquidBarcodesAgent.user.subscriptions[0].subscriptionId}}
{{context.liquidBarcodesAgent.stores.stores[0].name}}
{{context.liquidBarcodesAgent.receipts.receipts[0].receiptId}}
```

Older documentation may show `UserId`, `Subscriptions`, `SubscriptionId`, `Stores`, or `Receipts`. Read nodes preserve the response exactly, so inspect the Cognigy context after a successful request and use its actual casing. The extension accepts either casing only where it internally interprets a response, such as authentication fields and collection counts; it does not rewrite complete read responses.

## 4. Complete Node Input Matrix

Fields marked **default** should normally be left unchanged.

### Authentication nodes

| Node | Field | Required | Value to provide | Source or example |
| --- | --- | ---: | --- | --- |
| Request SSO Token | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Request SSO Token | User ID | Yes | Liquid Barcodes user identifier | Stored Cognigy profile/CRM value, or `{{context.liquidBarcodesAgent.user.userId}}` captured after an earlier OTP login |
| Request SSO Token | Store Result In | Yes | `liquidBarcodesAgent.ssoToken` | Keep default |
| Exchange SSO Token | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Exchange SSO Token | SSO Token | Yes | `{{context.liquidBarcodesAgent.ssoToken.token}}` | Keep default; token is single-use |
| Exchange SSO Token | Store Result In | Yes | `liquidBarcodesAgent.session` | Keep default |
| Start OTP | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Start OTP | Phone Number | Yes | Country code and number, digits only, no `+`, spaces, or punctuation | Example: `34111111111`; usually a sanitized Question-node answer |
| Start OTP | Store Result In | Yes | `liquidBarcodesAgent.otpStart` | Keep default |
| Verify OTP | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Verify OTP | Phone Number | Yes | Exactly the same phone used by Start OTP | `{{context.liquidBarcodesAgent.otpStart.phone}}` |
| Verify OTP | OTP Code | Yes | SMS code entered by the user | A Question-node answer such as `{{input.text}}`; do not log or persist it |
| Verify OTP | Store Result In | Yes | `liquidBarcodesAgent.session` | Keep default |

Successful Exchange SSO Token and Verify OTP calls both produce:

```json
{
  "accessToken": "<temporary-access-token>",
  "expiresInSeconds": 3600
}
```

### Read nodes

| Node | Field | Required | Value to provide | Source or example |
| --- | --- | ---: | --- | --- |
| Get User Profile | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Get User Profile | Access Token | Yes | `{{context.liquidBarcodesAgent.session.accessToken}}` | Keep default |
| Get User Profile | Store Result In | Yes | `liquidBarcodesAgent.user` | Keep default |
| Get Stores | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Get Stores | Access Token | Yes | `{{context.liquidBarcodesAgent.session.accessToken}}` | Keep default |
| Get Stores | Store ID | No | Liquid internal store ID, or blank for all stores | ID from a previous Get Stores result or a trusted business-system mapping |
| Get Stores | Store Result In | Yes | `liquidBarcodesAgent.stores` | Keep default |
| Get Machine Status | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Get Machine Status | Access Token | Yes | `{{context.liquidBarcodesAgent.session.accessToken}}` | Keep default |
| Get Machine Status | Last Update Time | No | ISO 8601 date/time, or blank for all current statuses | Example: `2026-09-29T00:00:00Z` |
| Get Machine Status | Store Result In | Yes | `liquidBarcodesAgent.machineStatus` | Keep default |
| Get Receipts | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Get Receipts | Access Token | Yes | `{{context.liquidBarcodesAgent.session.accessToken}}` | Keep default |
| Get Receipts | Store ID | No | Liquid internal store ID | Selected item from Get Stores, for example `{{context.liquidBarcodesAgent.stores.stores[0].id}}` |
| Get Receipts | Date From | No | ISO 8601 date/time | Example: `2026-01-01T00:00:00Z` |
| Get Receipts | Store Result In | Yes | `liquidBarcodesAgent.receipts` | Keep default |
| Get Subscription Users | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Get Subscription Users | Access Token | Yes | Owner access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Get Subscription Users | Subscription ID | Yes | ID of the selected multi-user subscription | `{{context.liquidBarcodesAgent.user.subscriptions[0].subscriptionId}}` |
| Get Subscription Users | Store Result In | Yes | `liquidBarcodesAgent.subscriptionUsers` | Keep default |

### Write nodes

| Node | Field | Required | Value to provide | Source or example |
| --- | --- | ---: | --- | --- |
| Add Subscription User | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Add Subscription User | Access Token | Yes | Subscription owner's access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Add Subscription User | Subscription ID | Yes | Selected multi-user subscription ID | `{{context.liquidBarcodesAgent.user.subscriptions[0].subscriptionId}}` |
| Add Subscription User | Personal Identifier | Yes | Identifier of the member being added, normally phone with country code and no `+` | Example: `34122222222`; this is not the member record ID |
| Add Subscription User | Store Result In | Yes | `liquidBarcodesAgent.addSubscriptionUser` | Keep default |
| Remove Subscription User | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Remove Subscription User | Access Token | Yes | Subscription owner's access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Remove Subscription User | Subscription ID | Yes | Parent multi-user subscription ID | Same selected subscription ID used by Get Subscription Users |
| Remove Subscription User | Subscription User ID | Yes | Member record `id` returned by Get Subscription Users | Selected member ID, not phone, user profile ID, or subscription ID |
| Remove Subscription User | Store Result In | Yes | `liquidBarcodesAgent.removeSubscriptionUser` | Keep default |
| Cancel Subscription | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Cancel Subscription | Access Token | Yes | Signed-in user's access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Cancel Subscription | Subscription ID | Yes | Subscription to cancel | Selected `subscriptionId` from Get User Profile; never use a member `id` |
| Cancel Subscription | Store Result In | Yes | `liquidBarcodesAgent.cancelSubscription` | Keep default |
| Set Plate Number | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Set Plate Number | Access Token | Yes | Signed-in user's access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Set Plate Number | Plate Number | Yes | New plate number for the signed-in user | Example: `ABC123`; validate according to business rules before calling |
| Set Plate Number | Store Result In | Yes | `liquidBarcodesAgent.setPlateNumber` | Keep default |
| Issue Coupon | Connection | Yes | Liquid Barcodes Agent API connection | Cognigy connection |
| Issue Coupon | Access Token | Yes | Signed-in user's access token | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Issue Coupon | Schedule ID | Yes | Coupon schedule configured by Liquid Barcodes | Obtain from Liquid Barcodes; do not substitute a store, coupon, or subscription ID |
| Issue Coupon | Expiration Date | No | ISO 8601 expiration date/time | Example: `2026-12-31T23:59:59Z` |
| Issue Coupon | Transaction ID | No | Caller-generated reference for tracking/idempotency according to business rules | Example: `order-2026-0001` |
| Issue Coupon | Store Result In | Yes | `liquidBarcodesAgent.issueCoupon` | Keep default |

Successful write operations store:

```json
{
  "success": true,
  "data": null
}
```

The API may return an object instead of an empty body, in which case that body is placed in `data`. Connect the **On Success** child for normal processing and the **On Error** child for recovery. The stored `success`, `data`, and `error` values remain available for diagnostics and business decisions.

## 5. Recommended Authentication Flows

### First-time or unidentified user: OTP

```text
Question: phone number
  -> Start OTP
  On Error -> explain and stop/retry
  On Success -> Question: SMS code
  -> Verify OTP
  On Error -> explain and retry/restart
  On Success -> Get User Profile
  On Error -> explain and stop
  On Success -> Save user.userId to a persistent Cognigy contact profile or CRM
```

Suggested values:

| Node | Field | Value |
| --- | --- | --- |
| Start OTP | Phone Number | Sanitized answer from the phone Question node |
| Verify OTP | Phone Number | `{{context.liquidBarcodesAgent.otpStart.phone}}` |
| Verify OTP | OTP Code | Answer from the OTP Question node |
| Get User Profile | Access Token | `{{context.liquidBarcodesAgent.session.accessToken}}` |

Use a stable Cognigy contact identity if the chat is embedded in an iframe. Do not rely on third-party iframe cookies for durable user mapping. Store the Liquid Barcodes user ID in the Cognigy contact profile, a parent application, or a backend/CRM appropriate to the solution.

### Returning identified user: SSO

```text
Read saved Liquid Barcodes user ID
  -> Request SSO Token
     On Error -> fall back to OTP or stop
     On Success -> Exchange SSO Token
        On Error -> request a fresh SSO token or fall back to OTP
        On Success -> Get User Profile
```

An SSO token is one-time use. Do not cache and exchange the same SSO token again.

## 6. Subscription Member Flows

### Select the correct subscription

1. Authenticate the subscription owner.
2. Run Get User Profile.
3. Read the live `subscriptions` array.
4. Keep only subscriptions where `isMultiUserPlan` is `true`.
5. Present plan names to the owner if more than one is available.
6. Store the selected item's `subscriptionId` in a flow context value, for example `selectedSubscriptionId`.

Do not assume `[0]` is the required subscription without checking the plan and state. Also check the subscription's `maxUsersAmount` before attempting to add another member.

### Add a member

```text
Authenticate owner
  -> Get User Profile
  -> Select multi-user subscription
  -> Ask for member phone/personal identifier
  -> Confirm member and subscription with owner
  -> Add Subscription User
      On Error -> explain the stored error
      On Success -> Get Subscription Users again
```

Required values:

```text
Access Token:        {{context.liquidBarcodesAgent.session.accessToken}}
Subscription ID:     {{context.selectedSubscriptionId}}
Personal Identifier: digits-only member phone, for example 34122222222
```

The Personal Identifier is the person to add. It is not the owner's user ID and not an existing member record ID.

### Remove one member

```text
Authenticate owner
  -> Get User Profile
  -> Select multi-user subscription
  -> Get Subscription Users
  -> Present members and select one
  -> Confirm removal with owner
  -> Remove Subscription User
      On Error -> explain the stored error
      On Success -> Get Subscription Users again
```

Required values:

```text
Access Token:         {{context.liquidBarcodesAgent.session.accessToken}}
Subscription ID:      {{context.selectedSubscriptionId}}
Subscription User ID: selected member record id from Get Subscription Users
```

Removing one member does not cancel the whole subscription.

### Cancel the whole subscription

```text
Authenticate user
  -> Get User Profile
  -> Select exact subscription
  -> Show plan and impact
  -> Require explicit confirmation
  -> Cancel Subscription
      On Error -> explain the stored error
      On Success -> Get User Profile again
```

**Destructive-operation warning:** Cancel Subscription acts on the subscription ID and affects the owner and all attached members. The current extension provides no undo or reactivation node. Cancellation timing, including whether it is immediate or effective at renewal, must be confirmed with Liquid Barcodes before production use.

## 7. Other Common Flows

### List stores and machine availability

```text
Authenticate
  -> Get Stores (leave Store ID blank)
     On Error -> handle store lookup failure
     On Success -> Get Machine Status
        On Error -> handle status lookup failure
        On Success -> Match each machine-status storeId to a store id
```

Live camelCase example:

```text
Store name: {{context.liquidBarcodesAgent.stores.stores[0].name}}
```

The machine-status response is also stored unchanged. Inspect whether the current environment returns `storeMachinesStatus`/`storeMachines` or their PascalCase equivalents before writing expressions.

### Retrieve receipts

```text
Authenticate
  -> Optional: Get Stores and select a store
  -> Get Receipts with optional Store ID and Date From
  On Error -> handle receipt lookup failure
  On Success -> present receipts
```

The receipt collection is available under `receipts` in the live camelCase response. The nested receipt payload may itself be a serialized text value and may require a Cognigy Code node before individual line items can be used.

### Set a plate number

Ask for the plate, validate and normalize it according to the business rules, confirm it with the signed-in user, then call Set Plate Number. The operation always updates the currently authenticated user.

### Issue a coupon

Authenticate the recipient, supply a Schedule ID obtained from Liquid Barcodes, and optionally supply an expiration date and transaction reference. A successful call confirms issuance but the current endpoint does not provide the resulting wash/coupon code in the documented response.

## 8. Built-in Success and Error Routing

Each API node automatically selects one of its two child paths after storing context:

- **On Success** is selected after a valid API response has been stored.
- **On Error** is selected after a normalized error has been stored.

A typical failure context is:

```json
{
  "error": {
    "message": "Bearer token is missing, expired, or invalid.",
    "code": "AuthenticationFailed",
    "errorCode": 1002,
    "status": 401
  }
}
```

Connect both children in the flow. Route every **On Error** child through the same reusable
error-handler flow by mapping its node-specific error into
`context.liquidBarcodesAgent.errorHandling.current` first.

### Create the shared error envelope

Add a Set Context node immediately beneath each **On Error** child. Replace `current` with:

```json
{
  "operation": "verifyOtp",
  "operationClass": "otpVerify",
  "sourceContextKey": "liquidBarcodesAgent.session",
  "error": "{{context.liquidBarcodesAgent.session.error}}"
}
```

Use the row for the originating extension node:

| Extension node | `operation` | `operationClass` | Default error expression |
| --- | --- | --- | --- |
| Request SSO Token | `requestSsoToken` | `authentication` | `{{context.liquidBarcodesAgent.ssoToken.error}}` |
| Exchange SSO Token | `exchangeSsoToken` | `authentication` | `{{context.liquidBarcodesAgent.session.error}}` |
| Start OTP | `startOtp` | `authentication` | `{{context.liquidBarcodesAgent.otpStart.error}}` |
| Verify OTP | `verifyOtp` | `otpVerify` | `{{context.liquidBarcodesAgent.session.error}}` |
| Get User Profile | `getUser` | `protectedRead` | `{{context.liquidBarcodesAgent.user.error}}` |
| Get Stores | `getStores` | `protectedRead` | `{{context.liquidBarcodesAgent.stores.error}}` |
| Get Machine Status | `getMachineStatus` | `protectedRead` | `{{context.liquidBarcodesAgent.machineStatus.error}}` |
| Get Receipts | `getReceipts` | `protectedRead` | `{{context.liquidBarcodesAgent.receipts.error}}` |
| Get Subscription Users | `getSubscriptionUsers` | `protectedRead` | `{{context.liquidBarcodesAgent.subscriptionUsers.error}}` |
| Add Subscription User | `addSubscriptionUser` | `protectedWrite` | `{{context.liquidBarcodesAgent.addSubscriptionUser.error}}` |
| Remove Subscription User | `removeSubscriptionUser` | `protectedWrite` | `{{context.liquidBarcodesAgent.removeSubscriptionUser.error}}` |
| Cancel Subscription | `cancelSubscription` | `protectedWrite` | `{{context.liquidBarcodesAgent.cancelSubscription.error}}` |
| Set Plate Number | `setPlateNumber` | `protectedWrite` | `{{context.liquidBarcodesAgent.setPlateNumber.error}}` |
| Issue Coupon | `issueCoupon` | `protectedWrite` | `{{context.liquidBarcodesAgent.issueCoupon.error}}` |

Set `sourceContextKey` to the path without the `context.` prefix and without `.error`. If
**Store Result In** was customized, use that configured value and its matching error
expression instead of the default shown above.

After Set Context, call a reusable flow such as **Handle Liquid Barcodes Error**. Keep retry
state outside `current` at `context.liquidBarcodesAgent.errorHandling.retryState`:

```json
{
  "reauthAttempted": false,
  "operationReplayAttempted": false,
  "otpAttempts": 0
}
```

### Build the shared If-node chain

Inside **Handle Liquid Barcodes Error**, configure If nodes in this order. Connect each
**No** branch to the next If node and use the **Yes** branch for the matched handling. Treat
`errorCode` as a string during comparison so numeric and string responses both match.

| Order | Internal branch | Match |
| ---: | --- | --- |
| 1 | `CONFIG_SIGNATURE` | `1003`, `InvalidSignature`, or `INVALID_SIGNATURE` |
| 2 | `INSUFFICIENT_SCOPE` | `1005` or `InsufficientScope` |
| 3 | `INPUT_INVALID` | `1001`, `InvalidInput`, `BOOTSTRAP_VALIDATION_FAILED`, or remaining status `400` |
| 4 | `AUTH_RECOVERY` | `1002` or `AuthenticationFailed` |
| 5 | `SESSION_RECOVERY` | `1004` or `SessionInvalid` |
| 6 | Status fallback | Remaining status `401`, `403`, `404`, or `409` |
| 7 | `UNKNOWN_TECHNICAL` | Default branch, including network errors and new provider codes |

Use exact provider `code` comparisons. Do not assume that uppercase codes and numeric codes
are aliases unless both are listed above. The extension preserves provider values as sent.

Under `AUTH_RECOVERY`, add a second If-node chain for `operationClass`:

| Operation class | Flow response |
| --- | --- |
| `otpVerify` | Show one neutral retry/resend route. Do not identify the underlying OTP failure. |
| `authentication` | Start a fresh OTP or SSO hand-off with bounded attempts. |
| `protectedRead` | Reauthenticate once, replay the read once, and stop if authentication fails again. |
| `protectedWrite` | Reauthenticate once, then refresh/check business state before deciding whether replay is safe. |

Apply the same read/write safety rule to session loss and ambiguous network failures. Never
automatically replay a write merely because its response was not received.

### Complete and reset the handler

- On recovery success, clear `errorHandling.current` and the operation-specific retry flags
  before continuing to the original success path.
- At the beginning of a new top-level user operation, reset stale retry flags.
- On terminal failure, route to a controlled stop or support path. Never fall through to an
  API success path.
- Log `operation`, `code`, `errorCode`, `status`, and `traceId` only through approved,
  sanitized diagnostics.
- Never put provider codes, status, trace IDs, raw provider messages, or internal branch
  labels into conversational output.

For Verify OTP `1002`, use the same neutral user behavior for unknown numbers, wrong or
expired codes, exhausted attempts, and frozen numbers. A suitable prompt is: "That didn't
work. Shall I send a new code?"

The complete policy and rationale are in
[Success and Error Branching](success-error-branching.md#shared-on-error-handler).
For the exact designer layout, Set Context entries, and full If value references, see
[On Error and If Node Setup](on-error-if-node-setup.md).

Older flow instances created before these children were introduced may not receive them automatically. In that case the node logs a warning and preserves its previous linear successor behavior until the node is recreated or its children are added in Cognigy.

## 9. Diagnostics and Safe Logging

Version `1.0.4` logs sanitized lifecycle information for requests and responses. Logs can show operation, URL, status, configured-value presence/length, and API error metadata. They intentionally do not log raw API keys, salts, tokens, OTPs, signatures, phone numbers, or request/response bodies.

When troubleshooting:

1. Confirm the expected extension version is installed.
2. Inspect the destination context object to distinguish success from failure.
3. Inspect Cognigy execution logs for the matching request lifecycle and HTTP status.
4. Verify all five connection values belong to the same environment.
5. Verify the access token has not expired.
6. Verify IDs were copied from the correct source object and were not confused with another ID type.
7. Do not add secrets to temporary logging or Say nodes.

A successful HTTP `200` plus data in context means the node succeeded even if an older log message reported a zero collection count. Version `1.0.4` corrects collection counting for camelCase `stores` and `receipts` responses.

## 10. Production Checklist

- [ ] Version `1.0.4` or later is installed in the target Cognigy environment.
- [ ] All five connection values are supplied by Liquid Barcodes and belong to the same sandbox or production environment.
- [ ] No credentials or user tokens are hard-coded in flow nodes.
- [ ] The flow uses camelCase paths verified from the target environment's context.
- [ ] Every extension node has both built-in On Success and On Error children connected and handled.
- [ ] Access-token expiry causes re-authentication; there is no automatic refresh.
- [ ] SSO tokens are requested fresh and exchanged only once.
- [ ] Phone values contain country code and digits only, without `+`.
- [ ] Subscription actions use the owner's access token where required.
- [ ] The flow distinguishes subscription IDs from subscription-member IDs.
- [ ] Member capacity is checked before adding a member.
- [ ] Member lists are refreshed after add/remove operations.
- [ ] Subscription cancellation requires explicit user confirmation.
- [ ] Cancellation timing and reactivation policy are confirmed with Liquid Barcodes.
- [ ] Coupon Schedule IDs are supplied and managed by Liquid Barcodes/business configuration.
- [ ] Sensitive context values are not included in conversational output or custom logs.

## 11. Items Still Requiring Liquid Barcodes Confirmation

The following behavior was not established by the extension implementation or live tests and should be confirmed before production flow design is finalized:

1. Whether OTP verification automatically registers a new user.
2. Whether an access-token refresh mechanism exists and whether token lifetime varies.
3. Whether one phone number can map to multiple users and how phone-number changes affect identity.
4. Whether another identity factor is available for sensitive operations.
5. Exact cancellation timing and whether reactivation is available through another channel.
6. Authoritative production response casing.
7. API rate limits.
8. Whether Issue Coupon has a separate operation for retrieving the generated coupon or wash code.

For complete endpoint and signing details, see [Agent API Reference](agent-api-reference.md). For field-by-field response descriptions, see [Node Input & Output Reference](node-input-output-reference.md).
