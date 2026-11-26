# Liquid Barcodes Agent API Extension

Cognigy.AI Extension for the Liquid Barcodes Agent API.

## Nodes

| Node | Endpoint | Description |
|------|----------|-------------|
| Exchange SSO Token | POST /v1/auth/sso | Swap an SSO token for an access token |
| Start OTP | POST /v1/auth/otp/start | Send OTP code via SMS |
| Verify OTP | POST /v1/auth/otp/verify | Verify OTP code and get access token |
| Get User Profile | GET /v1/user | Retrieve the authoritative current user profile and subscriptions |
| Get Audit Events | GET /v1/audit-events | Query customer audit events by user ID or phone without a customer session |
| Select Cancellation Subscription | Local only | Classify cancellable subscriptions from a fresh Get User profile using configured plan IDs |
| Get Stores | GET /v1/stores | List stores or get a specific store |
| Get Machine Status | GET /v1/stores/machines/status | Retrieve machine statuses |
| Get Receipts | GET /v1/receipts | Retrieve user receipts |
| Cancel Subscription | POST /v1/subscriptions/cancel | Cancel a user's subscription by ID |
| Get Subscription Users | GET /v1/subscriptions/{id}/users | List family members on a multi-user subscription |
| Add Subscription User | POST /v1/subscriptions/{id}/users | Add a family member to a multi-user subscription |
| Remove Subscription User | DELETE /v1/subscriptions/{id}/users/{userId} | Remove a family member from a subscription |
| Set Plate Number | PUT /v1/user/plate-number | Update the user's license plate number |
| Issue Coupon | POST /v1/coupons/issue | Issue a coupon using a required unique transaction ID |
| Get Device Limit | GET /v1/user/devices/limit | Check whether the user has reached the app-device limit |
| Clear User Devices | POST /v1/user/devices/clear | Clear the user's app devices using a required unique transaction ID |

## Connection

Create a **Liquid Barcodes Agent API** connection with:

- **baseUrl** - Agent API base URL (e.g., `https://agent.api.sandbox.eu1.l-b.dev`)
- **apiKey** - Your `X-Customer-Api-Key` value
- **signatureSalt** - Secret salt string from Liquid Barcodes, used to sign Agent API requests (SHA-256). Paste exactly as provided; environment-specific; never sent over the wire; not the same as `apiKey` or `appSecretKey`.
- **appBaseUrl** - App API base URL (used by the Request SSO Token node)
- **appSecretKey** - App API secret salt (used only by the Request SSO Token node)

## Build

```bash
npm install
npm run build
npm run pack:cognigy
```

Upload the generated `.tgz` file via **Manage > Extensions** in Cognigy.AI.

## Version 1.4.0 upgrade

Version `1.4.0` exposes **Exchange SSO Token** and **Issue Coupon**, adds **Get Audit Events**, and aligns coupon idempotency and error routing with the latest Agent API V1 guide. Coupon flows must provide a unique `transactionId`; audit queries must provide exactly one of user ID or phone.

## Version 1.3.1 upgrade

Version `1.3.1` moves cancellation selection out of **Get User Profile**. Existing cancellation flows must add **Select Cancellation Subscription** after Get User, move the **Allowed Car-Wash Plan IDs** configuration to that node, and branch on `liquidBarcodesAgent.cancellationSelection.outcome`. Reopen and save affected nodes after importing the extension.

## Cancellation flow ordering

**Get User Profile** is an independent authoritative read. It requires no cancellation configuration and stores the Liquid Barcodes response unchanged. Run it immediately before each cancellation attempt.

After Get User, run **Select Cancellation Subscription** with `{{context.liquidBarcodesAgent.user}}` and the environment-specific **Allowed Car-Wash Plan IDs** JSON array supplied by Liquid Barcodes/business, for example `[42, 108]`. The local node stores its result in `liquidBarcodesAgent.cancellationSelection` and makes no API request.

Branch on `cancellationSelection.outcome`: `selected`, `multipleCandidates`, `alreadyInactive`, `notOwner`, or `noMatch`. Only pass `selected.subscriptionId` to **Cancel Subscription** when the outcome is `selected`. For `multipleCandidates`, present the candidates and require an explicit customer choice rather than selecting the first record.

Require explicit confirmation immediately before **Cancel Subscription**. Cancellation normally takes effect at period end. After every successful or uncertain cancellation response, run **Get User Profile** again and verify that the selected subscription is `Cancelled` or no longer present.

## Too many devices flow

The Agent API integration must include the `user-devices:read` permission for **Get Device Limit** and `user-devices:write` for **Clear User Devices**.

**Get Device Limit** stores its result in `liquidBarcodesAgent.deviceLimit` by default. A successful response has the shape `{ success: true, data: { limitReached: boolean } }`. Both `true` and `false` use **On Success**; inspect `data.limitReached` in the flow to decide whether clearing is needed.

**Clear User Devices** stores its result in `liquidBarcodesAgent.clearUserDevices` by default. Supply a unique transaction ID of at most 128 characters for each intended clear operation. Reuse that ID only when retrying the same uncertain request. A successful result is `Cleared` or `NothingToClear` inside the standard success envelope.

Clear rejections use **On Error**. Inspect `liquidBarcodesAgent.errorHandling.current` for `DeviceClearLimitReached` (`140`), `DuplicateIdempotencyKey` (`1007`), `RequestRejected` (`1000`), authentication recovery, and diagnostic `traceId` details. Do not expose provider error details directly to the customer.

## Test

```bash
npm test
npm run test:coverage
```

For integration tests against the sandbox, set environment variables:

```bash
export LB_AGENT_BASE_URL=https://agent.api.sandbox.eu1.l-b.dev
export LB_AGENT_API_KEY=your-api-key
export LB_AGENT_SIGNATURE_SALT=your-salt
export LB_AGENT_TEST_SSO_TOKEN=your-test-sso-token  # optional
export LB_AGENT_TEST_PHONE=your-test-phone           # optional
```
