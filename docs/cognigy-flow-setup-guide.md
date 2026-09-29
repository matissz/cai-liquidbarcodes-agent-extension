# Cognigy Flow Setup Guide for Liquid Barcodes Agent

This guide consolidates the implementation details and sandbox findings verified while configuring and testing version `1.0.4` of the Liquid Barcodes Agent extension. It is intended for Cognigy flow builders who need to know exactly which values each node requires, where those values come from, and which context paths to use afterward.

> Never paste real API keys, signature salts, access tokens, SSO tokens, or OTP codes into documentation, Say nodes, or logs. The examples below use placeholders.

## 1. Important Findings

1. The live sandbox returns response properties in **camelCase**, although older API examples use PascalCase.
2. Authentication nodes normalize their output to camelCase, such as `accessToken` and `expiresInSeconds`.
3. Read nodes store the Liquid Barcodes response body unchanged. Use the property names visible in the Cognigy context. For the live sandbox, use camelCase paths.
4. Every node stores an error in its configured context destination instead of stopping the flow. Add an error check after every extension node.
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

The API may return an object instead of an empty body, in which case that body is placed in `data`. Always check `error` first and `success` second.

## 5. Recommended Authentication Flows

### First-time or unidentified user: OTP

```text
Question: phone number
  -> Start OTP
  -> IF otpStart.error: explain and stop/retry
  -> Question: SMS code
  -> Verify OTP
  -> IF session.error: explain and retry/restart
  -> Get User Profile
  -> IF user.error: explain and stop
  -> Save user.userId to a persistent Cognigy contact profile or CRM
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
  -> IF ssoToken.error: fall back to OTP or stop
  -> Exchange SSO Token
  -> IF session.error: request a fresh SSO token or fall back to OTP
  -> Get User Profile
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
  -> Check addSubscriptionUser.error
  -> On success, Get Subscription Users again
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
  -> Check removeSubscriptionUser.error
  -> On success, Get Subscription Users again
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
  -> Check cancelSubscription.error
  -> On success, Get User Profile again
```

**Destructive-operation warning:** Cancel Subscription acts on the subscription ID and affects the owner and all attached members. The current extension provides no undo or reactivation node. Cancellation timing, including whether it is immediate or effective at renewal, must be confirmed with Liquid Barcodes before production use.

## 7. Other Common Flows

### List stores and machine availability

```text
Authenticate
  -> Get Stores (leave Store ID blank)
  -> Check stores.error
  -> Get Machine Status
  -> Check machineStatus.error
  -> Match each machine-status storeId to a store id
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
  -> Check receipts.error
```

The receipt collection is available under `receipts` in the live camelCase response. The nested receipt payload may itself be a serialized text value and may require a Cognigy Code node before individual line items can be used.

### Set a plate number

Ask for the plate, validate and normalize it according to the business rules, confirm it with the signed-in user, then call Set Plate Number. The operation always updates the currently authenticated user.

### Issue a coupon

Authenticate the recipient, supply a Schedule ID obtained from Liquid Barcodes, and optionally supply an expiration date and transaction reference. A successful call confirms issuance but the current endpoint does not provide the resulting wash/coupon code in the documented response.

## 8. Error Handling Required After Every Node

Failures are stored in the selected context destination and the Cognigy flow continues. A typical failure is:

```json
{
  "error": {
    "message": "Bearer token is missing, expired, or invalid.",
    "code": "AUTHENTICATION_FAILED",
    "status": 401
  }
}
```

Add an IF node after each call and check the matching path:

| Extension node | Error expression |
| --- | --- |
| Request SSO Token | `{{context.liquidBarcodesAgent.ssoToken.error}}` |
| Exchange SSO Token or Verify OTP | `{{context.liquidBarcodesAgent.session.error}}` |
| Start OTP | `{{context.liquidBarcodesAgent.otpStart.error}}` |
| Get User Profile | `{{context.liquidBarcodesAgent.user.error}}` |
| Get Stores | `{{context.liquidBarcodesAgent.stores.error}}` |
| Get Machine Status | `{{context.liquidBarcodesAgent.machineStatus.error}}` |
| Get Receipts | `{{context.liquidBarcodesAgent.receipts.error}}` |
| Get Subscription Users | `{{context.liquidBarcodesAgent.subscriptionUsers.error}}` |
| Add Subscription User | `{{context.liquidBarcodesAgent.addSubscriptionUser.error}}` |
| Remove Subscription User | `{{context.liquidBarcodesAgent.removeSubscriptionUser.error}}` |
| Cancel Subscription | `{{context.liquidBarcodesAgent.cancelSubscription.error}}` |
| Set Plate Number | `{{context.liquidBarcodesAgent.setPlateNumber.error}}` |
| Issue Coupon | `{{context.liquidBarcodesAgent.issueCoupon.error}}` |

Common handling:

| Status or code | Likely cause | Flow response |
| --- | --- | --- |
| `400` | Missing, malformed, or invalid node value | Ask for corrected input; do not repeat a write automatically |
| `401 AUTHENTICATION_FAILED` | Missing or expired access token | Re-authenticate the user |
| `401 INVALID_SIGNATURE` | Wrong key/salt, wrong environment, or signing-value mismatch | Stop and have an administrator verify the connection |
| `404` | Incorrect subscription, member, store, user, or schedule identifier | Refresh source data and let the user select again |
| `409` or business-rule error | Duplicate member, member limit, invalid subscription state, or similar conflict | Explain the returned message and refresh account data |

Do not expose raw backend errors or identifiers to end users. Use the error object for branching and log correlation, then show a suitable business-facing message.

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
- [ ] Every extension node is followed by an error branch.
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
