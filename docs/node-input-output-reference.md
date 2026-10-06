# Liquid Barcodes Agent Extension — Node Input & Output Reference

> **Who is this for?** This guide is written for business users and flow builders. For each
> node in the extension it explains, in plain language, **what you put in** (inputs) and
> **what you get back** (outputs), plus any current limitations. No coding knowledge is
> required.
>
> For the bigger picture (authentication flows, connection setup, example conversations),
> see the [Extension Usage Guide](extension-usage-guide.md).

---

## How to read this guide

Every node works the same way at a high level:

1. **You fill in some fields** (the inputs) in the node's settings panel.
2. **The node calls Liquid Barcodes** in the background.
3. **The result is saved into the conversation context** under a name you choose in the
   **"Store Result In"** field. Later nodes and Say nodes can then read that result.

### Three things that are true for almost every node

| Concept | What it means |
|---|---|
| **Connection** | Every node needs the shared **Liquid Barcodes Agent API** connection selected. This holds the credentials. Set it up once (see the Usage Guide). |
| **Access Token** | Most nodes need a valid login (access token). It is filled in **automatically** from the sign-in step, so you normally leave it as-is. |
| **Store Result In** | The context name where the result is saved (e.g. `liquidBarcodesAgent.user`). You can change it, but the defaults are recommended. |

### About the connection's `signatureSalt`

One connection field is easy to get wrong, so it's worth calling out: **`signatureSalt`**.

- It is a **secret string provided by Liquid Barcodes** for the Agent API. The extension uses it to
  "sign" every request so Liquid Barcodes can confirm the request is genuine.
- **Paste it exactly as given** — no quotes, no extra spaces or line breaks.
- **It must match the environment** — sandbox and production have *different* salts.
- **It is not the API key** and **not** `appSecretKey`. These are three separate values.
- It is **never sent over the internet**; it is only used locally to build the signature.

If the salt is missing, mistyped, or from the wrong environment, **every** node fails with an
`INVALID_SIGNATURE` error (status `401`). See [Extension Usage Guide → Connection Setup](extension-usage-guide.md#connection-setup)
for full details.

### Success vs. error — always check first

Every node produces **one of two** possible results:

- **Success** → the normal result described for that node below.
- **Failure** → an object with an `error` inside it, for example:

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

> **Important:** Every API node stores its result first, then selects **On Success** or
> **On Error**. Add a native Cognigy If node beneath On Error and compare
> `{{context.liquidBarcodesAgent.errorHandling.current.error.errorCode}}` first. Use the
> stored `outcome` only for errors without a recognized Liquid Barcodes numeric code.
> `{{context.liquidBarcodesAgent.errorHandling.current}}` contains the common envelope
> for operation-specific recovery and trace correlation. Provider error values must not be shown to
> users. See the [shared On Error handler setup](cognigy-flow-setup-guide.md#8-built-in-success-and-error-routing).

---

## The correct sequence: sign in, then get the user profile

Getting a user's profile always follows the same shape: **authenticate first, then call
Get User Profile.** Signing in produces an **access token** (saved in
`context.liquidBarcodesAgent.session`), and Get User Profile reads that token
**automatically**. Pick **one** of the two sign-in paths below.

### Path A — SSO (when you already know the user's User ID)

Silent, no user interaction. Three nodes in order:

```text
1. Request SSO Token   →  context.liquidBarcodesAgent.ssoToken   { token, expirationDate }
2. Exchange SSO Token  →  context.liquidBarcodesAgent.session    { accessToken, expiresInSeconds }
3. Get User Profile    →  context.liquidBarcodesAgent.user       full profile
```

1. **Request SSO Token** — you provide the user's `User ID`. *(App API)*
2. **Exchange SSO Token** — the token from step 1 is auto-filled; this creates the access
   token. *(Agent API)*
3. **Get User Profile** — the access token is auto-filled; this returns the profile.

### Path B — OTP (phone / SMS, for first-time or unknown users)

Requires the user to enter an SMS code. Three nodes, with a question in between:

```text
1. Start OTP           →  context.liquidBarcodesAgent.otpStart   { phone }
     [ user receives an SMS and types the code ]
2. Verify OTP          →  context.liquidBarcodesAgent.session    { accessToken, expiresInSeconds }
3. Get User Profile    →  context.liquidBarcodesAgent.user       full profile
```

1. **Start OTP** — you provide the phone number (digits only, country code, no `+`). An SMS
   code is sent.
2. Ask the user for the code, then run **Verify OTP** with the **same phone** + the code; this
   creates the access token.
3. **Get User Profile** — the access token is auto-filled; this returns the profile.

### Both paths meet at the same point

Notice both paths end identically: step 2 stores the login under
`context.liquidBarcodesAgent.session`, and **Get User Profile** reads
`context.liquidBarcodesAgent.session.accessToken` automatically. So once the user is signed
in, the profile call is the same regardless of which path was used — and so is every other
data/action node.

> 💡 **Tip:** After a first-time **OTP** sign-in, save
> `context.liquidBarcodesAgent.user.UserId` to your Cognigy contact profile. On the next
> visit you can use the silent **SSO** path and skip the phone/SMS step entirely.

### Connect Success and Error children between each step

Connect the next API operation beneath **On Success**. Connect a retry, fallback, or friendly
message beneath **On Error**. The following context paths provide details inside Error paths:

| After this node | Diagnostic context path | Typical Error-child handling |
|---|---|---|
| Request SSO Token | `context.liquidBarcodesAgent.ssoToken.error` | Stop / show "couldn't verify account" |
| Exchange SSO Token | `context.liquidBarcodesAgent.session.error` | Stop / show "authentication failed" |
| Start OTP | `context.liquidBarcodesAgent.otpStart.error` | Stop / re-ask the phone number |
| Verify OTP | `context.liquidBarcodesAgent.session.error` | Use the neutral OTP retry/resend route |
| Get User Profile | `context.liquidBarcodesAgent.user.error` | Stop / show "couldn't load profile" |

---

# Authentication Nodes

These nodes sign a user in. The end goal is an **access token**, which every other node needs.
There are two ways to sign in — by **SSO** (when you already know the user) or by **phone/SMS
(OTP)**. See the Usage Guide for how to choose.

---

## 1. Request SSO Token

**What it does:** Creates a one-time sign-in token for a user you already know (by their
Liquid Barcodes User ID). This is the first step of the SSO sign-in path.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| User ID | Yes | The Liquid Barcodes User ID of the person signing in | `abc123-user-id` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.ssoToken` |

### Output (on success)

```json
{
  "token": "lbssonewtoken...",
  "expirationDate": "2026-01-27T15:25:36Z"
}
```

| Field | Meaning |
|---|---|
| `token` | The one-time SSO token. Feed this into **Exchange SSO Token** next. |
| `expirationDate` | When the token stops being valid. |

**Limitations / notes**
- The token is **single-use** — generate a fresh one for each sign-in.
- Needs a valid Liquid Barcodes User ID up front. If you don't have one, use the phone (OTP)
  path instead.

---

## 2. Exchange SSO Token

**What it does:** Turns the one-time SSO token into an **access token** the rest of the
extension can use. This is the second step of the SSO sign-in path.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| SSO Token | Yes | The token from **Request SSO Token** (filled in automatically) | `{{context.liquidBarcodesAgent.ssoToken.token}}` |
| Store Result In | Yes | Where to save the session | `liquidBarcodesAgent.session` |

### Output (on success)

```json
{
  "accessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "expiresInSeconds": 3600
}
```

| Field | Meaning |
|---|---|
| `accessToken` | The login token. All later nodes read this automatically. |
| `expiresInSeconds` | How long the login stays valid (usually 3600 seconds = 1 hour). |

**Limitations / notes**
- After this step every data/action node works automatically — no need to copy the token by
  hand.
- The token expires (see the note on token expiry at the bottom).

---

## 3. Start OTP

**What it does:** Sends a one-time code by SMS to a phone number. This is the first step of the
phone sign-in path.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Phone Number | Yes | Digits only, with country code, **no leading `+`** | `34111111111` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.otpStart` |

### Output (on success)

```json
{
  "phone": "34111111111"
}
```

| Field | Meaning |
|---|---|
| `phone` | The phone number the SMS was sent to. Reuse it in **Verify OTP**. |

**Limitations / notes**
- The phone number **must be digits only with the country code and no `+`** (e.g.
  `34111111111` for Spain, `1234567890` for the US). A `+` or spaces will cause failures.
- This only sends the code. You must then ask the user for the code and pass it to
  **Verify OTP**.

---

## 4. Verify OTP

**What it does:** Checks the SMS code the user typed and, if correct, returns an **access
token**. Second step of the phone sign-in path.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Phone Number | Yes | The **same** phone number used in Start OTP | `34111111111` |
| OTP Code | Yes | The code the user received via SMS | `3565` |
| Store Result In | Yes | Where to save the session | `liquidBarcodesAgent.session` |

### Output (on success)

```json
{
  "accessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "expiresInSeconds": 3600
}
```

Same result as **Exchange SSO Token** — you now have a valid login.

**Limitations / notes**
- The phone number must match exactly what was used in Start OTP.
- Whether OTP registers brand-new users automatically is **not yet confirmed** with Liquid
  Barcodes (see open questions in the Usage Guide).

---

# Data (Read) Nodes

These nodes **read information**. They all need a valid login (access token), which is filled
in automatically after sign-in.

---

## 5. Get User Profile

**What it does:** Fetches the signed-in user's full profile — name, email, subscriptions,
consents, payment methods, plate number, and more.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Store Result In | Yes | Where to save the profile | `liquidBarcodesAgent.user` |

### Output (on success)

The full user profile is saved. The most useful fields:

| Field | Meaning |
|---|---|
| `UserId` | The user's Liquid Barcodes ID (store this for future SSO sign-ins). |
| `Msn` | Mobile number (country code + digits). |
| `Name` / `Surname` | The user's name. |
| `Emails` | List of email addresses. |
| `Subscriptions` | List of subscriptions — each has `PlanName`, `SubscriptionId`, `SubscriptionState`, `IsMultiUserPlan`, renewal info, and balance. |
| `Consents` | Consent/agreement statuses. |
| `PaymentMethods` | Saved payment methods. |
| `PlateNumber` | The user's saved license plate (if any). |

Example of reading values afterwards:

```
{{context.liquidBarcodesAgent.user.Name}}
{{context.liquidBarcodesAgent.user.Subscriptions[0].PlanName}}
```

**Limitations / notes**
- This is where you get the **User ID** and **Subscription IDs** needed by the subscription
  action nodes below.

---

## 6. Get Stores

**What it does:** Lists all stores, or looks up a single store when you provide a store ID.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Store ID | No | A single store's ID. **Leave empty for all stores.** | `123` |
| Store Result In | Yes | Where to save the list | `liquidBarcodesAgent.stores` |

### Output (on success)

```json
{
  "Stores": [
    {
      "Id": 123,
      "Name": "Main Street Wash",
      "Address": "123 Main St",
      "CurrentState": "Open",
      "Latitude": 59.33,
      "Longitude": 18.06,
      "OpeningHours": ["08:00-20:00", "..."]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `Stores[].Id` | The store's internal ID (used by Get Receipts / Machine Status). |
| `Stores[].Name` / `Address` | Store name and address. |
| `Stores[].CurrentState` | `Open`, `Closed`, `TemporarilyClosed`, or `PermanentlyClosed`. |
| `Stores[].Latitude` / `Longitude` | Location coordinates. |
| `Stores[].OpeningHours` | 7 entries (Mon–Sun), each like `"08:00-20:00"` or empty when closed. |

**Limitations / notes**
- Even when you ask for a single store, the result is still a **list** (`Stores`) — read the
  first item (`Stores[0]`).

---

## 7. Get Machine Status

**What it does:** Shows the status of machines (e.g. car wash machines) grouped by store.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Last Update Time | No | Only return machines that changed **after** this date/time (ISO 8601). Leave empty for everything. | `2026-07-01T00:00:00Z` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.machineStatus` |

### Output (on success)

```json
{
  "StoreMachinesStatus": [
    {
      "StoreId": 123,
      "Status": "Available",
      "StoreMachines": [
        {
          "Name": "Wash Bay 1",
          "Status": "Available",
          "ActivationTypesAvailable": ["Code", "Trigger"]
        }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `StoreMachinesStatus[].StoreId` | Matches the `Id` from **Get Stores**. |
| `StoreMachinesStatus[].Status` | Overall status for the store: `Available` or `OutOfService`. |
| `.StoreMachines[].Name` | Machine name. |
| `.StoreMachines[].Status` | `Available`, `OutOfService`, or `Offline`. |
| `.StoreMachines[].ActivationTypesAvailable` | How the machine can be started: `Code` and/or `Trigger`. |

**Limitations / notes**
- Statuses cover **all stores** at once — there is no single-store filter, only the optional
  "changed after" time filter.

---

## 8. Get Receipts

**What it does:** Fetches the signed-in user's purchase receipts, optionally filtered by store
and/or date.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Store ID | No | Only receipts from this store | `123` |
| Date From | No | Only receipts from this date onwards (ISO 8601) | `2026-01-01T00:00:00Z` |
| Store Result In | Yes | Where to save the receipts | `liquidBarcodesAgent.receipts` |

### Output (on success)

```json
{
  "Logo": "https://.../logo.png",
  "Receipts": [
    {
      "ReceiptId": "abc-123",
      "Format": "Liquid/1.0",
      "Receipt": "{ ...raw receipt as text... }"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `Logo` | URL of the company logo. |
| `Receipts[].ReceiptId` | The receipt's ID. |
| `Receipts[].Format` | Format identifier (e.g. `Liquid/1.0`). |
| `Receipts[].Receipt` | The full receipt as a **text string** — needs extra parsing to read individual line items. |

**Limitations / notes**
- The `Receipt` field is a packed text string, **not** ready-to-read fields. Displaying line
  items requires a Code node to parse it.
- This call can be **slow**. In the current version there is **no built-in time limit**, so a
  slow response will make the flow wait until Liquid Barcodes replies.

---

## 9. Get Subscription Users

**What it does:** Lists the people (family members) attached to a **multi-user** subscription.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Subscription ID | Yes | The multi-user subscription's ID (from **Get User Profile**) | `4567` |
| Store Result In | Yes | Where to save the list | `liquidBarcodesAgent.subscriptionUsers` |

### Output (on success)

```json
{
  "Users": [
    { "Id": 9001, "PersonalIdentifier": "34111111111", "Name": "Jane" }
  ]
}
```

| Field | Meaning |
|---|---|
| `Users[].Id` | The subscription-user ID — needed to **remove** that person. |
| `Users[].PersonalIdentifier` | How the member was added (e.g. phone number). |
| `Users[].Name` | The member's name (if available). |

**Limitations / notes**
- Only meaningful for subscriptions where `IsMultiUserPlan` is `true` on the user profile.

---

# Action (Write) Nodes

These nodes **change something** in the user's account. They all need a valid login.

> **Output shape for all action nodes:** Liquid Barcodes replies to these with a simple
> "OK" and no details. On success the node saves:
>
> ```json
> { "success": true, "data": null }
> ```
>
> On failure it saves an `error` object instead (see the error section at the top). So the
> way to confirm an action worked is: **no `error`, and `success` is `true`.**

---

## 10. Cancel Subscription

**What it does:** Cancels a subscription by its ID.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Subscription ID | Yes | The subscription to cancel (from **Get User Profile**) | `4567` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.cancelSubscription` |

### Output (on success)

```json
{ "success": true, "data": null }
```

**Limitations / notes**
- **Cancellation timing is not confirmed** — whether it cancels immediately or at the next
  renewal date should be checked with Liquid Barcodes.
- This is a permanent account change. Confirm with the user before running it.

---

## 11. Add Subscription User

**What it does:** Adds a person (family member) to a multi-user subscription.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Subscription ID | Yes | The multi-user subscription's ID | `4567` |
| Personal Identifier | Yes | Who to add — usually their phone number | `34111111111` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.addSubscriptionUser` |

### Output (on success)

```json
{ "success": true, "data": null }
```

**Limitations / notes**
- Only the subscription **owner** can add members.
- There is a maximum number of members (`MaxUsersAmount` on the subscription). Adding beyond
  the limit will fail.

---

## 12. Remove Subscription User

**What it does:** Removes a person (family member) from a multi-user subscription.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Subscription ID | Yes | The multi-user subscription's ID | `4567` |
| Subscription User ID | Yes | The member's ID from **Get Subscription Users** (`Users[].Id`) | `9001` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.removeSubscriptionUser` |

### Output (on success)

```json
{ "success": true, "data": null }
```

**Limitations / notes**
- You need the **Subscription User ID** (from Get Subscription Users), not the person's phone
  number.
- Only the subscription **owner** can remove members.

---

## 13. Set Plate Number

**What it does:** Updates the signed-in user's saved license plate number.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Plate Number | Yes | The new license plate | `ABC123` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.setPlateNumber` |

### Output (on success)

```json
{ "success": true, "data": null }
```

**Limitations / notes**
- Always applies to the **currently signed-in** user — there is no field to set someone
  else's plate.

---

## 14. Issue Coupon

**What it does:** Issues a coupon (for example, a single car-wash code) to the signed-in user.

### Inputs

| Field | Required? | What to put in | Example |
|---|---|---|---|
| Connection | Yes | The Liquid Barcodes Agent API connection | — |
| Access Token | Yes | The login token (filled in automatically) | `{{context.liquidBarcodesAgent.session.accessToken}}` |
| Schedule ID | Yes | The coupon/schedule ID to issue (provided by Liquid Barcodes) | `789` |
| Expiration Date | No | When the issued coupon should expire (ISO 8601) | `2026-12-31T23:59:59Z` |
| Transaction ID | No | Your own reference for this issue (for tracking) | `order-2026-0001` |
| Store Result In | Yes | Where to save the result | `liquidBarcodesAgent.issueCoupon` |

### Output (on success)

```json
{ "success": true, "data": null }
```

**Limitations / notes**
- The response confirms success only — it does **not** return the coupon/wash code itself in
  the current version.
- The correct **Schedule ID** (e.g. for a single car wash) must be obtained from Liquid
  Barcodes.

---

# General Limitations (apply to all nodes)

- **Login expires:** Access tokens usually last 1 hour (`expiresInSeconds`). There is **no
  automatic refresh**. If a node returns an authentication error, sign the user in again.
- **SSO tokens are single-use:** Each token from Request SSO Token can be exchanged only once.
- **Failures use On Error:** A failed node saves an `error` object plus the classified
  `outcome`, then routes to **On Error**. Use a native Cognigy If node for finer routing.
- **Rate limits:** Not documented yet — leave reasonable gaps between calls.
- **Phone format:** Digits only, with country code, no leading `+`.
- **Identity is phone-only:** In the phone (OTP) path, a phone number + SMS code is the only
  identity check. Consider this for sensitive actions (viewing payment info, cancelling
  subscriptions).

---

## Quick reference — where each result is stored

| Node | Default "Store Result In" | Success content |
|---|---|---|
| Request SSO Token | `liquidBarcodesAgent.ssoToken` | `{ token, expirationDate }` |
| Exchange SSO Token | `liquidBarcodesAgent.session` | `{ accessToken, expiresInSeconds }` |
| Start OTP | `liquidBarcodesAgent.otpStart` | `{ phone }` |
| Verify OTP | `liquidBarcodesAgent.session` | `{ accessToken, expiresInSeconds }` |
| Get User Profile | `liquidBarcodesAgent.user` | Full user profile |
| Get Stores | `liquidBarcodesAgent.stores` | `{ Stores: [...] }` |
| Get Machine Status | `liquidBarcodesAgent.machineStatus` | `{ StoreMachinesStatus: [...] }` |
| Get Receipts | `liquidBarcodesAgent.receipts` | `{ Logo, Receipts: [...] }` |
| Get Subscription Users | `liquidBarcodesAgent.subscriptionUsers` | `{ Users: [...] }` |
| Cancel Subscription | `liquidBarcodesAgent.cancelSubscription` | `{ success, data }` |
| Add Subscription User | `liquidBarcodesAgent.addSubscriptionUser` | `{ success, data }` |
| Remove Subscription User | `liquidBarcodesAgent.removeSubscriptionUser` | `{ success, data }` |
| Set Plate Number | `liquidBarcodesAgent.setPlateNumber` | `{ success, data }` |
| Issue Coupon | `liquidBarcodesAgent.issueCoupon` | `{ success, data }` |
