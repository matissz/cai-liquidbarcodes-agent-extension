# Liquid Barcodes Agent API Extension

Cognigy.AI Extension for the Liquid Barcodes Agent API.

## Nodes

| Node | Endpoint | Description |
|------|----------|-------------|
| Exchange SSO Token | POST /v1/auth/sso | Swap an SSO token for an access token |
| Start OTP | POST /v1/auth/otp/start | Send OTP code via SMS |
| Verify OTP | POST /v1/auth/otp/verify | Verify OTP code and get access token |
| Get User Profile | GET /v1/user | Retrieve signed-in user's profile |
| Get Stores | GET /v1/stores | List stores or get a specific store |
| Get Machine Status | GET /v1/stores/machines/status | Retrieve machine statuses |
| Get Receipts | GET /v1/receipts | Retrieve user receipts |
| Cancel Subscription | POST /v1/subscriptions/cancel | Cancel a user's subscription by ID |
| Get Subscription Users | GET /v1/subscriptions/{id}/users | List family members on a multi-user subscription |
| Add Subscription User | POST /v1/subscriptions/{id}/users | Add a family member to a multi-user subscription |
| Remove Subscription User | DELETE /v1/subscriptions/{id}/users/{userId} | Remove a family member from a subscription |
| Set Plate Number | PUT /v1/user/plate-number | Update the user's license plate number |
| Issue Coupon | POST /v1/coupons/issue | Issue a coupon (e.g. a single wash code) to the user |

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
