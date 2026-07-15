# Liquid Barcodes Agent Extension -- Usage Guide

> **Status:** Initial draft. Will be updated as the full API documentation is provided and additional methods are implemented.

---

## Overview

This Cognigy extension integrates with the Liquid Barcodes Agent API and App API to provide loyalty program functionality within chat flows. It exposes 14 nodes covering authentication, data retrieval, and account actions (cancel subscription, manage family members, update plate number, issue a wash code).

All nodes share a single connection (`Liquid Barcodes Agent API`) that holds credentials for both APIs.

---

## Connection Setup

Before using any node, create a connection of type **Liquid Barcodes Agent API** in Cognigy with these 5 fields:

| Field | Description |
|---|---|
| `baseUrl` | Agent API base URL (e.g., `https://agent.api.sandbox.eu1.l-b.dev`) |
| `apiKey` | Agent API key -- sent as the `X-Customer-Api-Key` header |
| `signatureSalt` | Agent API **signature salt** -- a secret string used to sign requests. Never sent over the wire. See below. |
| `appBaseUrl` | App API base URL (e.g., `https://circlekus-demo.feeds.sandbox.eu1.l-b.dev/`) |
| `appSecretKey` | App API secret key -- the App API's own signature salt, used only by the Request SSO Token node |

All values are provided by Liquid Barcodes. The Agent API and App API are separate services with different base URLs and signing keys.

### What to put in `signatureSalt`

`signatureSalt` is an **opaque secret string** supplied by Liquid Barcodes for the Agent API. It is
used to build the `X-Liquid-Signature` header on every request: the extension concatenates the
request timestamp, the operation-specific values, and the salt, then takes a **SHA-256 hash** of the
result (see the [API Reference](agent-api-reference.md#authentication--request-signing) for the exact
per-endpoint order).

When entering it:

- **Paste it exactly as provided** by Liquid Barcodes -- no surrounding quotes, no extra spaces or
  line breaks. The value is used as-is (only leading/trailing whitespace is trimmed).
- **Match the environment.** Sandbox and production use *different* salts. Using a sandbox salt
  against production (or vice versa) will fail.
- **It is not the API key.** `signatureSalt` and `apiKey` are two different secrets. The API key is
  sent as a header; the salt is never transmitted -- it is only used locally to compute the
  signature.
- **It is not `appSecretKey`.** `appSecretKey` is the equivalent salt for the *App API* and is used
  only by the Request SSO Token node.

If the salt is wrong (or from the wrong environment), every Agent API call fails with an
`INVALID_SIGNATURE` error (HTTP 401). See [Error Handling](#error-handling).

---

## Authentication Flows

The extension supports two authentication paths. Both produce an **access token** that is required by all data nodes.

### Flow A: SSO Authentication (recommended for identified users)

Use this when you already have a Liquid Barcodes UserId (e.g., from a CRM lookup or previous session).

```
Request SSO Token  -->  Exchange SSO Token  -->  Data Nodes
     (App API)            (Agent API)
```

**Step 1: Request SSO Token**

| | |
|---|---|
| **Node** | Request SSO Token |
| **Input** | `userId` -- the Liquid Barcodes UserId |
| **API** | App API: `POST {appBaseUrl}/auth/lb/tokens` |
| **Output** | Stored in `context.liquidBarcodesAgent.ssoToken` |

Output structure:

```json
{
  "token": "lbssonewtoken...",
  "expirationDate": "2026-01-27T15:25:36Z"
}
```

**Step 2: Exchange SSO Token**

| | |
|---|---|
| **Node** | Exchange SSO Token |
| **Input** | `ssoToken` -- defaults to `{{context.liquidBarcodesAgent.ssoToken.token}}` (auto-wired from Step 1) |
| **API** | Agent API: `POST {baseUrl}/v1/auth/sso` |
| **Output** | Stored in `context.liquidBarcodesAgent.session` |

Output structure:

```json
{
  "accessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "expiresInSeconds": 3600
}
```

After this step, the access token is available at `{{context.liquidBarcodesAgent.session.accessToken}}` and all data nodes read it automatically.

### Flow B: OTP Authentication (phone-based)

Use this when authenticating a user by phone number (SMS one-time password).

```
Start OTP  -->  [User enters SMS code]  -->  Verify OTP  -->  Data Nodes
```

**Step 1: Start OTP**

| | |
|---|---|
| **Node** | Start OTP |
| **Input** | `phone` -- digits only, country code included, no leading `+` (e.g., `34111111111`) |
| **API** | Agent API: `POST {baseUrl}/v1/auth/otp/start` |
| **Output** | Stored in `context.liquidBarcodesAgent.otpStart` |

Output structure:

```json
{
  "phone": "34111111111"
}
```

An SMS with a one-time code is sent to the phone number. The flow should then prompt the user to enter the code.

**Step 2: Verify OTP**

| | |
|---|---|
| **Node** | Verify OTP |
| **Input** | `phone` -- same phone from Step 1; `code` -- the SMS code entered by the user |
| **API** | Agent API: `POST {baseUrl}/v1/auth/otp/verify` |
| **Output** | Stored in `context.liquidBarcodesAgent.session` |

Output structure:

```json
{
  "accessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "expiresInSeconds": 3600
}
```

This produces the same session structure as the SSO flow. All data nodes work the same regardless of which auth flow was used.

---

## Choosing the Auth Flow

At the start of every conversation, the flow must decide which auth path to use. The decision is simple:

```
Does the flow have a Liquid Barcodes UserId for this user?
  |
  +-- YES (e.g., stored in Cognigy profile)
  |     --> SSO path: automatic, no user interaction
  |
  +-- NO (first-time user or unknown identity)
        --> OTP path: ask phone, send SMS, verify code
        --> Then: Get User Profile to capture UserId
        --> Store UserId for next time --> future sessions use SSO
```

In a Cognigy flow, this looks like:

```
1. [IF] {{profile.lbUserId}} exists
     --> Go to SSO auth branch
   [ELSE]
     --> Go to OTP auth branch
```

### First-Contact Pattern (OTP → capture UserId → store for SSO)

The first time a user interacts with the chatbot, no UserId is available. The OTP flow authenticates them by phone, and the UserId is captured from the user profile for future sessions:

```
1. [Question] "Please enter your phone number (with country code, digits only)"
   --> User types: 34111111111

2. [Start OTP]
   phone: {{input.text}}
   --> SMS sent, result in context.liquidBarcodesAgent.otpStart

3. [IF] context.liquidBarcodesAgent.otpStart.error
   --> Say "We couldn't send a verification code. Please check your number."
   --> END

4. [Question] "Enter the code you received via SMS"
   --> User types: 3565

5. [Verify OTP]
   phone: {{context.liquidBarcodesAgent.otpStart.phone}}
   code: {{input.text}}
   --> Session created in context.liquidBarcodesAgent.session

6. [IF] context.liquidBarcodesAgent.session.error
   --> Say "Invalid code. Please try again."
   --> Go back to step 4 (or restart)

7. [Get User Profile]
   accessToken: (auto-filled)
   --> User data in context.liquidBarcodesAgent.user

8. [Update Profile]
   Set profile.lbUserId = {{context.liquidBarcodesAgent.user.UserId}}
   --> UserId saved for future sessions

9. [Say] "Welcome, {{context.liquidBarcodesAgent.user.Name}}!"
   --> Continue to data nodes (stores, subscriptions, etc.)
```

On the **next conversation**, step 1's IF check finds `profile.lbUserId` and takes the SSO path instead -- no phone prompt, no SMS, fully automatic.

---

## Persisting UserId Across Sessions (iframe on mobile)

The chatbot runs in an iframe on mobile. Persisting the UserId across sessions requires careful consideration because **iframes cannot reliably store data themselves** (third-party cookies are blocked, localStorage is partitioned).

### Option A: Cognigy Contact Profile (recommended)

After first OTP, store the UserId in the Cognigy Contact Profile using an Update Profile node. On return visits, Cognigy loads the profile automatically.

**Requirement:** The parent page (hosting the iframe) must pass a stable `userId` to the Cognigy webchat widget so Cognigy can recognize the same user across sessions.

```javascript
// Parent page -- webchat widget initialization
WebchatWidget.init({
  userId: "app-user-12345",  // stable ID from parent app's auth
  // ... other config
});
```

If the hosting app has its own authentication (app login, customer account), use that user ID as the Cognigy `userId`. Cognigy then maintains a persistent Contact Profile tied to that identity.

**Pros:** Works across devices, survives browser data clearing, no extra backend work.
**Requires:** Parent page has a way to identify the user (its own auth system).

### Option B: Parent page localStorage

If the parent page does not have its own user auth, it can store the `lbUserId` in its own localStorage (not the iframe's) and pass it to the webchat widget on each load.

```javascript
// Parent page -- after first conversation, chatbot signals lbUserId back
const lbUserId = getLbUserIdFromChatbotCallback();
localStorage.setItem('lb_user_id', lbUserId);

// On next page load, pass to webchat
const storedId = localStorage.getItem('lb_user_id');
WebchatWidget.init({
  userId: storedId || generateAnonymousId(),
  data: { lbUserId: storedId }
});
```

**Pros:** No backend needed, works on same device.
**Cons:** Lost if user clears browser data. Device-specific (won't carry over to a different phone).

### Option C: Backend / CRM storage

Store the `phone → lbUserId` mapping on your own server. The parent page queries the backend to resolve the user before initializing the chatbot.

**Pros:** Most secure. Works across all devices. Central source of truth.
**Cons:** Requires backend development and an API endpoint.

### Not recommended: cookies inside the iframe

Third-party cookies are blocked by default in Safari (ITP), Chrome (Storage Partitioning), and Firefox (ETP). Storing the UserId in cookies inside the chatbot iframe will not persist across sessions.

### Summary

| Approach | Persists across devices | Survives data clear | Backend needed | Parent page auth needed |
| --- | --- | --- | --- | --- |
| **A. Cognigy Profile** | Yes | Yes | No | Yes |
| **B. Parent localStorage** | No | No | No | No |
| **C. Backend / CRM** | Yes | Yes | Yes | No |

**Recommendation:** Use Option A if the parent page has any form of user identity (most common for apps). Fall back to Option B for anonymous/unauthenticated pages. Consider Option C for enterprise deployments.

---

## Open Questions for Liquid Barcodes

These questions affect flow design and should be clarified before production deployment:

1. **New-user registration:** Does OTP auto-register a new user on first verify, or must a separate registration endpoint be called first? (Covers both "does OTP only work for existing users" and "is there a registration API".)

2. **Phone number as identity:** Can one phone number map to multiple users? And if a user changes their phone number, does their UserId stay valid, and how is the new phone linked?

3. **User lookup / validation without auth:** Is there an endpoint to look up or validate a user by phone, email, or UserId *without* an access token? This one capability would let the flow (a) tell new vs. returning users apart upfront, (b) confirm a stored UserId is still valid before attempting SSO, and (c) re-identify a returning user on a new device without relying solely on phone OTP.

4. **Token lifetime & refresh:** Is `ExpiresInSeconds` consistent or variable? Should the flow cache and reuse a token within a conversation, and is any refresh mechanism available (currently there is none)?

5. **Second identity factor (security):** Phone + SMS OTP is currently the *only* identity check, yet an authenticated session exposes the full profile (name, email, subscriptions, payment methods, receipts) and stores the UserId for future SSO. If a number is compromised (SIM swap, recycling, social engineering) an attacker could reach the account. Is a second factor (email confirmation, PIN, security question) available — especially for sensitive operations like payment methods, receipts, or cancelling a subscription?

6. **Write-operation behavior:** What exactly do the action endpoints do — does **Cancel Subscription** apply immediately or at next renewal, and does **Issue Coupon** return (or make retrievable) the actual coupon/wash code? (The endpoints currently return only success/failure, no data.)

7. **API contract details:** What are the rate limits (undocumented so far), and which JSON casing is authoritative in production? The sandbox returns camelCase while the API reference examples use PascalCase.

---

## Data Nodes

All data nodes require an authenticated session. They read the access token from `{{context.liquidBarcodesAgent.session.accessToken}}` by default (auto-wired from either auth flow).

### Get User Profile

| | |
|---|---|
| **Node** | Get User Profile |
| **Input** | `accessToken` (auto-wired) |
| **API** | Agent API: `GET {baseUrl}/v1/user` |
| **Output** | Stored in `context.liquidBarcodesAgent.user` |

Returns the full user profile including name, email, subscriptions, consents, payment methods, and external identifiers.

Key fields in the response:

| Field | Type | Description |
|---|---|---|
| `UserId` | string | Liquid Barcodes user ID |
| `Msn` | string | Mobile number (country code + digits) |
| `Name` / `Surname` | string | User's name |
| `Emails` | string[] | Email addresses |
| `Subscriptions` | array | Active subscriptions (plan name, state, renewal info) |
| `Consents` | array | Consent statuses |

Example usage in a flow after this node:

```
{{context.liquidBarcodesAgent.user.Name}}
{{context.liquidBarcodesAgent.user.Subscriptions[0].PlanName}}
```

### Get Stores

| | |
|---|---|
| **Node** | Get Stores |
| **Input** | `accessToken` (auto-wired); `storeId` (optional -- leave empty for all stores) |
| **API** | Agent API: `GET {baseUrl}/v1/stores` |
| **Output** | Stored in `context.liquidBarcodesAgent.stores` |

Returns a list of all stores, or a single store when `storeId` is provided.

Key fields per store:

| Field | Type | Description |
|---|---|---|
| `Id` | number | Liquid internal store ID |
| `ExternalId` | number | Customer's external ID |
| `Name` | string | Store name |
| `Address` | string | Store address |
| `Latitude` / `Longitude` | number | Geolocation |
| `CurrentState` | string | `Open`, `Closed`, `TemporarilyClosed`, or `PermanentlyClosed` |
| `OpeningHours` | string[] | 7 entries (Mon-Sun), each `"HH:MM-HH:MM"` or `null` if closed |

Example usage:

```
{{context.liquidBarcodesAgent.stores.Stores[0].Name}}
{{context.liquidBarcodesAgent.stores.Stores[0].CurrentState}}
```

### Get Machine Status

| | |
|---|---|
| **Node** | Get Machine Status |
| **Input** | `accessToken` (auto-wired); `lastUpdateTime` (optional -- ISO 8601, filters to changes after this time) |
| **API** | Agent API: `GET {baseUrl}/v1/stores/machines/status` |
| **Output** | Stored in `context.liquidBarcodesAgent.machineStatus` |

Returns machine statuses grouped by store (e.g., car wash machines).

Key fields:

| Field | Type | Description |
|---|---|---|
| `StoreMachinesStatus[].StoreId` | number | Store ID (matches `Get Stores` Id) |
| `StoreMachinesStatus[].Status` | string | Aggregate: `Available` or `OutOfService` |
| `StoreMachinesStatus[].StoreMachines[]` | array | Individual machines |
| `.StoreMachines[].Name` | string | Machine name |
| `.StoreMachines[].Status` | string | `Available`, `OutOfService`, or `Offline` |
| `.StoreMachines[].ActivationTypesAvailable` | string[] | `Code` and/or `Trigger` |

Example usage:

```
{{context.liquidBarcodesAgent.machineStatus.StoreMachinesStatus[0].Status}}
{{context.liquidBarcodesAgent.machineStatus.StoreMachinesStatus[0].StoreMachines[0].Name}}
```

### Get Receipts

| | |
|---|---|
| **Node** | Get Receipts |
| **Input** | `accessToken` (auto-wired); `storeId` (optional); `dateFrom` (optional -- ISO 8601) |
| **API** | Agent API: `GET {baseUrl}/v1/receipts` |
| **Output** | Stored in `context.liquidBarcodesAgent.receipts` |

Returns the user's transaction receipts. This endpoint may be slow -- the extension uses a 30-second timeout.

Key fields:

| Field | Type | Description |
|---|---|---|
| `Logo` | string | URL to company logo |
| `Receipts[].ReceiptId` | string | Receipt ID |
| `Receipts[].Format` | string | Format identifier (e.g., `Liquid/1.0`) |
| `Receipts[].Receipt` | string | JSON string of the full receipt (needs parsing) |

Example usage:

```
{{context.liquidBarcodesAgent.receipts.Receipts.length}}
{{context.liquidBarcodesAgent.receipts.Logo}}
```

---

## Action Nodes

These nodes perform state-changing operations. All require an `accessToken` (auto-wired from the
session) and follow the same error pattern as the data nodes. Write endpoints return `200 OK`
with no body; on success the result stored in context is `{ success: true, data }`.

### Cancel Subscription

| | |
|---|---|
| **Node** | Cancel Subscription |
| **Input** | `accessToken` (auto-wired); `subscriptionId` (from Get User Profile) |
| **API** | Agent API: `POST {baseUrl}/v1/subscriptions/cancel` |
| **Output** | Stored in `context.liquidBarcodesAgent.cancelSubscription` |

Cancels the subscription with the given ID. Cancellation timing (immediate vs. next renewal)
should be confirmed with Liquid Barcodes.

### Get Subscription Users

| | |
|---|---|
| **Node** | Get Subscription Users |
| **Input** | `accessToken` (auto-wired); `subscriptionId` |
| **API** | Agent API: `GET {baseUrl}/v1/subscriptions/{subscriptionId}/users` |
| **Output** | Stored in `context.liquidBarcodesAgent.subscriptionUsers` |

Lists the family members on a multi-user subscription (a subscription where `IsMultiUserPlan`
is true on the user profile).

### Add Subscription User

| | |
|---|---|
| **Node** | Add Subscription User |
| **Input** | `accessToken` (auto-wired); `subscriptionId`; `personalIdentifier` (e.g. phone) |
| **API** | Agent API: `POST {baseUrl}/v1/subscriptions/{subscriptionId}/users` |
| **Output** | Stored in `context.liquidBarcodesAgent.addSubscriptionUser` |

Adds a family member to a multi-user subscription (owner only, up to `MaxUsersAmount`).

### Remove Subscription User

| | |
|---|---|
| **Node** | Remove Subscription User |
| **Input** | `accessToken` (auto-wired); `subscriptionId`; `userId` (from Get Subscription Users) |
| **API** | Agent API: `DELETE {baseUrl}/v1/subscriptions/{subscriptionId}/users/{userId}` |
| **Output** | Stored in `context.liquidBarcodesAgent.removeSubscriptionUser` |

Removes a family member from a multi-user subscription.

### Set Plate Number

| | |
|---|---|
| **Node** | Set Plate Number |
| **Input** | `accessToken` (auto-wired); `plateNumber` |
| **API** | Agent API: `PUT {baseUrl}/v1/user/plate-number` |
| **Output** | Stored in `context.liquidBarcodesAgent.setPlateNumber` |

Updates the signed-in user's license plate number.

### Issue Coupon

| | |
|---|---|
| **Node** | Issue Coupon |
| **Input** | `accessToken` (auto-wired); `scheduleId`; `expirationDate` (optional); `transactionId` (optional) |
| **API** | Agent API: `POST {baseUrl}/v1/coupons/issue` |
| **Output** | Stored in `context.liquidBarcodesAgent.issueCoupon` |

Issues a coupon (e.g. a single wash code) to the signed-in user. Confirm the `scheduleId` to use
for a single car wash with Liquid Barcodes.

---

## Error Handling

Every node follows the same error pattern. On failure, the result stored in context contains an `error` object instead of the normal response:

```json
{
  "error": {
    "message": "The request signature is invalid.",
    "code": "INVALID_SIGNATURE",
    "status": 401
  }
}
```

In your Cognigy flow, check for errors with a condition like:

```
{{context.liquidBarcodesAgent.session.error}}
```

If truthy, the call failed. The `message` field contains a human-readable description. Common error codes:

| Code | Status | Meaning |
|---|---|---|
| `INVALID_SIGNATURE` | 401 | Signature or timestamp is invalid -- check connection credentials |
| `BOOTSTRAP_VALIDATION_FAILED` | 400 | Request validation failed -- check input fields |
| `AUTHENTICATION_FAILED` | 401 | Bearer token is missing, expired, or invalid |

---

## Context Key Reference

Default context keys used by each node. All are customizable via the "Store Result In" field.

| Node | Default Context Key | Content |
|---|---|---|
| Request SSO Token | `liquidBarcodesAgent.ssoToken` | `{ token, expirationDate }` |
| Exchange SSO Token | `liquidBarcodesAgent.session` | `{ accessToken, expiresInSeconds }` |
| Start OTP | `liquidBarcodesAgent.otpStart` | `{ phone }` |
| Verify OTP | `liquidBarcodesAgent.session` | `{ accessToken, expiresInSeconds }` |
| Get User Profile | `liquidBarcodesAgent.user` | Full user object |
| Get Stores | `liquidBarcodesAgent.stores` | `{ Stores: [...] }` |
| Get Machine Status | `liquidBarcodesAgent.machineStatus` | `{ StoreMachinesStatus: [...] }` |
| Get Receipts | `liquidBarcodesAgent.receipts` | `{ Logo, Receipts: [...] }` |
| Cancel Subscription | `liquidBarcodesAgent.cancelSubscription` | `{ success, data }` |
| Get Subscription Users | `liquidBarcodesAgent.subscriptionUsers` | Subscription users list |
| Add Subscription User | `liquidBarcodesAgent.addSubscriptionUser` | `{ success, data }` |
| Remove Subscription User | `liquidBarcodesAgent.removeSubscriptionUser` | `{ success, data }` |
| Set Plate Number | `liquidBarcodesAgent.setPlateNumber` | `{ success, data }` |
| Issue Coupon | `liquidBarcodesAgent.issueCoupon` | `{ success, data }` |

---

## Example Flow: SSO Login and Check Subscription

A typical Cognigy flow using the SSO path to look up a user's subscription:

```
1. [Request SSO Token]
   userId: {{profile.lbUserId}}
   --> stores token in context.liquidBarcodesAgent.ssoToken

2. [IF] context.liquidBarcodesAgent.ssoToken.error
   --> Say "Sorry, we couldn't verify your account."
   --> END

3. [Exchange SSO Token]
   ssoToken: (auto-filled from step 1)
   --> stores session in context.liquidBarcodesAgent.session

4. [IF] context.liquidBarcodesAgent.session.error
   --> Say "Authentication failed. Please try again."
   --> END

5. [Get User Profile]
   accessToken: (auto-filled from step 3)
   --> stores user in context.liquidBarcodesAgent.user

6. [Say]
   "Hi {{context.liquidBarcodesAgent.user.Name}}!
    Your subscription: {{context.liquidBarcodesAgent.user.Subscriptions[0].PlanName}}
    Status: {{context.liquidBarcodesAgent.user.Subscriptions[0].SubscriptionState}}"
```

## Example Flow: Find Nearest Open Store with Car Wash

```
1. [Authenticate via SSO or OTP] (steps as above)

2. [Get Stores]
   --> stores all stores in context.liquidBarcodesAgent.stores

3. [Get Machine Status]
   --> stores machine data in context.liquidBarcodesAgent.machineStatus

4. [Code Node / Logic]
   Filter stores where CurrentState == "Open"
   Cross-reference with machineStatus to find stores
   where at least one machine Status == "Available"

5. [Say]
   "The nearest open car wash is at {{storeName}}, {{storeAddress}}.
    Machine: {{machineName}} -- Status: Available"
```

---

## Notes and Limitations

- **Token expiry:** Access tokens expire (typically 3600 seconds). There is currently no auto-refresh mechanism. If a data node returns an authentication error, re-run the auth flow.
- **SSO tokens are single-use:** Each token generated by Request SSO Token can only be exchanged once. Generate a new one for each session.
- **Receipt data:** The `Receipt` field is a JSON string that needs additional parsing if you want to display individual line items.
- **Phone format:** OTP phone numbers must be digits only with country code, no leading `+` (e.g., `34111111111` for Spain, `1234567890` for US).
- **Rate limits:** Not documented yet. Use reasonable intervals between calls.
