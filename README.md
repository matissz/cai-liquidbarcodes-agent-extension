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

## Connection

Create a **Liquid Barcodes Agent API** connection with:

- **baseUrl** - API base URL (e.g., `https://agent.api.sandbox.eu1.l-b.dev`)
- **apiKey** - Your `X-Customer-Api-Key` value
- **signatureSalt** - Signature salt for request signing

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
