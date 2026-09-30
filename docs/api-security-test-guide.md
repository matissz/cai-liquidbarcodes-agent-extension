# API Security Test Guide

## Scope

The security tests are in `src/__tests__/security/` and run without credentials or
network traffic. They use `axios-mock-adapter` to test controls owned by this
extension: signed request construction, bearer-token handling, safe parameter
transport, timeouts, and credential-safe logging.

The test names use OWASP API Security Top 10 **2023** identifiers because 2023 is
the latest published API-specific OWASP Top 10 edition. The year identifies the
edition; it is not the year in which these tests were written.

## Dedicated Outbound Cases

`outbound-api-security.test.ts` contains 13 generated Jest cases:

| OWASP category | Test case | Expected protection |
|---|---|---|
| API2 Broken Authentication | No invented Authorization header | Pre-auth requests have no fabricated or stale bearer token. |
| API2 | Access token placement | A token appears only as `Authorization: Bearer <token>`, never in URL, query, or body. |
| API2 | Whitespace-only access token | Blank tokens do not create an Authorization header. |
| API8 Security Misconfiguration | API key and signature placement | API key and signature use their designated headers; API key and salt do not enter URL, query, or body. |
| API8 | GET request shape | GET requests discard accidental bodies and do not declare JSON content without a body. |
| API10 Unsafe Consumption | SQL-like query payload | The value remains a structured query parameter and cannot alter the fixed path. |
| API10 | XSS-like query payload | Markup remains data at the outbound boundary. |
| API10 | Path-traversal query payload | Traversal text cannot change the endpoint path. |
| API10 | CRLF query payload | Newlines remain parameter data and cannot add an outbound header. |
| API10 | Credential-safe success logs | API key, salt, and bearer token are absent from lifecycle logs. |
| API10 | Credential-safe upstream-error logs | Credentials echoed by an upstream error are redacted before logging. |
| API10 | OTP/SSO field redaction | Phone, OTP code, and SSO token echoed by an upstream error are replaced with `[REDACTED]`. |
| API4 Unrestricted Resource Consumption | Finite timeout | Every outbound call has a positive timeout; the client limit is 15 seconds. |

`credential-leakage.test.ts` applies cross-cutting checks to all extension nodes:

- The signature salt never enters context, logs, headers, or request bodies.
- The API key appears only in `X-Customer-Api-Key` where required.
- The App API secret never enters context, logs, headers, or request bodies.
- API and network failures do not leak API keys or salts.
- SQL-like, XSS-like, null-byte, Unicode, and very long values do not crash nodes.
- App API, pre-auth Agent API, protected read, and protected write nodes send the
  expected header profile.
- A `javascript:` connection URL fails closed and stores an error.

## OWASP Applicability

| OWASP API Security 2023 category | Coverage | Boundary |
|---|---|---|
| API1 Broken Object Level Authorization | Live/provider only | Liquid Barcodes enforces resource ownership. |
| API2 Broken Authentication | Mocked and safe live | The extension constructs auth headers; live bad-signature/session behavior validates the provider contract. |
| API3 Broken Object Property Level Authorization | Live/provider only | Field authorization and mass assignment are server responsibilities. |
| API4 Unrestricted Resource Consumption | Partial mocked | The extension enforces a timeout; provider rate and body limits require provider testing. |
| API5 Broken Function Level Authorization | Live/provider only | Endpoint role authorization is remote. |
| API6 Unrestricted Access to Sensitive Business Flows | Stateful live only | OTP, coupon, and subscription abuse controls require an approved sandbox scenario. |
| API7 Server Side Request Forgery | Not request-data applicable | Node paths are fixed; base URLs are administrator-controlled connection settings. |
| API8 Security Misconfiguration | Mocked | Header placement, request shape, and secret handling are extension-owned. |
| API9 Improper Inventory Management | Documentation review | Versions and endpoint paths are statically declared and reviewed against the provider contract. |
| API10 Unsafe Consumption of APIs | Mocked | Structured transport and hostile upstream logging are extension-owned. |

## LB Authentication Contracts

Authentication tests additionally verify Liquid Barcodes-specific behavior:

- OTP start maps `InvalidInput` / numeric `errorCode` `1001` without dropping data.
- OTP verification maps uniform `AuthenticationFailed` / `1002` failures, which
  avoids exposing whether a phone, code, attempt counter, or expiry check failed.
- Protected calls preserve `SessionInvalid` / `1004` and
  `InsufficientScope` / `1005`.
- OTP and SSO inputs are trimmed once and the same value is signed and transmitted.
- Successful OTP/SSO responses must contain a nonblank access token and a positive,
  finite expiry. Malformed HTTP 200 responses are stored as errors.
- PascalCase contract responses and camelCase sandbox responses are both accepted.
- Sessions are treated as issued sessions with an expiry; no refresh token is
  invented by the extension.

## Run Independently

Run both mocked security files:

```powershell
npm run test:security
```

Run one security file:

```powershell
npx jest --runInBand src/__tests__/security/outbound-api-security.test.ts
npx jest --runInBand src/__tests__/security/credential-leakage.test.ts
```

Run all deterministic tests, excluding live sandbox traffic:

```powershell
npm test
```

Run the live sandbox contract suite explicitly:

```powershell
npm run test:integration
```

The live suite requires `LB_AGENT_BASE_URL`, `LB_AGENT_API_KEY`, and
`LB_AGENT_SIGNATURE_SALT`. Optional SSO/App API sections are declaration-time
skipped unless their documented variables are available.

OTP start sends SMS and changes server-side attempt/cooldown state. It is disabled
unless all OTP variables are present **and** the explicit opt-in is set:

```powershell
$env:LB_RUN_STATEFUL_OTP_TESTS='true'
npm run test:integration
```

Use only approved non-production credentials and test users. The live suite also
contains protected write-signature checks, including a plate-number
read-modify-restore scenario; review the target sandbox before running it.