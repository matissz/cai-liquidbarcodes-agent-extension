# Email draft — Liquid Barcodes: Agent API gaps & questions for Circle K chatbot Phase 1

> Draft to send to the Liquid Barcodes integration team. Plain language; edit the greeting/sign-off as needed.

**Subject:** Circle K chatbot — Agent API: R&D status, input/output verification, and Phase 1 questions

Hi team,

A quick note on where we are. So far this has been an **R&D / proof-of-concept** effort: we've
built the Circle K car-wash chatbot integration against the Agent API and exercised it against the
**sandbox** to prove the approach works end to end. At this stage we've implemented the following
Phase 1 actions and confirmed the request flow against the sandbox:

- Identify the customer, find stores, check machine status, pull receipts
- **Cancel a subscription** — `POST /v1/subscriptions/cancel`
- **Manage family members** — `GET/POST/DELETE /v1/subscriptions/{id}/users`
- **Change the license plate** — `PUT /v1/user/plate-number`
- **Issue a wash code / coupon** — `POST /v1/coupons/issue`

To be clear on scope: **we are not yet in a position to say this is ready for production.** Before
we could stand behind a production launch we need to **verify the input/output contract** of each
endpoint against confirmed, authoritative behaviour — request fields, response bodies, and the
exact side effects of the write operations — rather than relying on what we've inferred from the
sandbox. The sandbox has been valuable for proving the integration, but we've also seen it diverge
from the reference documentation (see the casing point in section 3), so we can't treat sandbox
behaviour alone as the production contract.

The items below are what we need from you to move from this R&D state toward something we'd be
confident deploying. Three Phase 1 use cases also have **no matching endpoint** in the Agent API
today. Details follow.

## 1. Missing capabilities — can these be exposed on the Agent API?

1. **Equipment down / malfunction / "I paid but didn't get my wash."**
   There is no endpoint to report a broken machine, or to issue a **refund** or a **replacement
   wash** for a failed attempt. What is the intended flow for the chatbot here — is issuing a
   coupon (`/v1/coupons/issue`) the "replacement," and are refunds handled somewhere else (App
   API / back office)? If an Agent API endpoint is planned, when?

2. **Change device ID.**
   The user-update request (`PATCH /v1/user`) has no device field, and there is no device
   endpoint. How should the chatbot change the device associated with an account?

3. **"Too many devices."**
   There is no endpoint to list a user's devices or to remove/reset one, and no documented
   device limit or error code. How should the chatbot resolve a customer who is blocked by a
   device limit?

For all three: can they be exposed **through the Agent API** (our preferred, per the gateway
design), or should we call the **App API** directly? If the App API already covers them, could
you share access to the App API reference/spec so we can verify?

## 2. Confirmations on endpoints we've already built

4. **Wash code (`POST /v1/coupons/issue`).** We send `scheduleId` (and optional `expirationDate`,
   `transactionId`). What `scheduleId` should we use to grant a customer a **single car wash**,
   and is this the correct endpoint for that? Is there a response body we should read (e.g. the
   issued code)?

5. **Cancel subscription (`POST /v1/subscriptions/cancel`).** Does cancellation take effect
   **immediately** or at the **next renewal**? Which field on `GET /v1/user` reflects the result
   (e.g. `subscriptionState = Cancelled`)?

## 3. Response format (casing) — please confirm the production standard

Our reference doc shows response fields in **PascalCase** (e.g. `AccessToken`, `UserId`,
`PlateNumber`), but the **sandbox currently returns camelCase** (`accessToken`, `userId`,
`plateNumber`). Request bodies are camelCase in both. Which casing is authoritative for
**production**? We need this to parse responses reliably — and this mismatch is exactly the kind of
input/output detail we need locked down before we can call the integration production-ready.

Once we have your answers on the above, we can complete the input/output verification and give you
a clear read on what's needed for a production launch. Happy to jump on a quick call. Thanks!

---

## Internal notes (not part of the email)

- Signature order for the four built write endpoints was verified against the sandbox (see
  `src/__tests__/integration.test.ts`, "Phase 1 write endpoints (signature verification)").
- The camelCase drift also affects the **existing** auth/data nodes (they read `AccessToken`,
  `UserId`, etc.). Those nodes will not parse live sandbox responses correctly until adapted —
  tracked separately from the Phase 1 build.
- Agent API also exposes additional profile-update endpoints beyond Phase 1 (name, address,
  gender, culture, emails, preferred stores, default payment method, consents, groups).
