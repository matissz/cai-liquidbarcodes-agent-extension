# Success and Error Branching

## Decision

Every Liquid Barcodes API node exposes two shared Cognigy mini children:

- **On Success** continues after a valid response has been stored in context.
- **On Error** continues after a normalized error has been stored in context.

The two child descriptors are shared by all 14 API nodes. They represent execution outcomes, not endpoint-specific business states.

## Why branching belongs in the node

Previously, every flow author had to add an IF node after every API call and repeat the same check against the configured context destination. That duplicated infrastructure behavior in each flow and made it easy to continue after a failed request accidentally.

The API node already knows whether response validation succeeded or its request entered the error path. Routing at that point gives every flow the same explicit contract without inferring outcomes from endpoint-specific payload shapes.

## Runtime order

Each parent node follows this order:

1. Call the Liquid Barcodes API and validate any required response fields.
2. Store the existing success payload in the configured context destination.
3. Select **On Success**.

On failure it instead:

1. Normalize the provider or network error.
2. Store `{ error: ... }` in the configured context destination.
3. Select **On Error**.

Context is deliberately retained. Branches control execution, while context provides response data, error classification, HTTP status, numeric `errorCode`, and `traceId` correlation where supplied by the provider.

## Compatibility

Newly created parent nodes declare both children as dependencies. Older flow instances may not receive added dependency children automatically. If an expected child is absent, the routing utility logs a warning and leaves Cognigy's existing linear successor unchanged. Recreate or update the node in Cognigy to adopt explicit branches.

Duplicate children are prevented by the descriptor contract in normal use. If malformed flow configuration contains duplicates, routing selects the first child with the expected descriptor type.

## Security boundary

The branch only describes whether the extension accepted a response as successful. In particular, **Start OTP: On Success** means the provider accepted a correctly formed request. It does not confirm that an account exists or that an SMS was delivered. This preserves Liquid Barcodes' OTP anti-enumeration behavior.

Detailed recovery belongs beneath **On Error** and may inspect the stored error. Do not expose raw provider messages, identifiers, or trace values directly to users.

## Error codes

The documented numeric authentication catalogue is:

| Code | Numeric errorCode | HTTP status |
| --- | ---: | ---: |
| `InvalidInput` | `1001` | 400 |
| `AuthenticationFailed` | `1002` | 401 |
| `InvalidSignature` | `1003` | 401 |
| `SessionInvalid` | `1004` | 401 |
| `InsufficientScope` | `1005` | 403 |

The Agent API reference separately uses uppercase `BOOTSTRAP_VALIDATION_FAILED` and `INVALID_SIGNATURE` without numeric mappings. The guides previously used `AUTHENTICATION_FAILED`, but the provider source does not establish that spelling as an alias. The extension preserves upstream codes exactly and does not infer mappings between these vocabularies.

New provider codes do not require new child descriptors. They remain available in context beneath **On Error** for flow-specific handling.

## Shared On Error handler

Use one reusable Cognigy flow for error handling. The extension runtime remains unchanged:
each API node stores its error in its configured **Store Result In** destination and then
selects **On Error**. The flow beneath that child maps the stored error into this flow-owned
envelope before calling the shared handler:

```json
{
  "operation": "verifyOtp",
  "operationClass": "otpVerify",
  "sourceContextKey": "liquidBarcodesAgent.session",
  "error": "{{context.liquidBarcodesAgent.session.error}}"
}
```

Store the envelope at `context.liquidBarcodesAgent.errorHandling.current`. Replace it on
every entry; do not merge it with the previous failure. `sourceContextKey` must match the
node's configured **Store Result In** value when a flow changes the default.

Use these operation classes:

| Operation class | Use for |
| --- | --- |
| `otpVerify` | Verify OTP |
| `authentication` | Request SSO Token, Exchange SSO Token, and Start OTP |
| `protectedRead` | Get User Profile, Get Stores, Get Machine Status, Get Receipts, and Get Subscription Users |
| `protectedWrite` | Cancel Subscription, Add/Remove Subscription User, Set Plate Number, and Issue Coupon |

Keep loop-control state separately at
`context.liquidBarcodesAgent.errorHandling.retryState`. At minimum track
`reauthAttempted`, `operationReplayAttempted`, and an OTP conversation attempt counter.
Reset the relevant state after recovery succeeds and when a new top-level user operation
begins. Do not store retry state inside an API result destination because a later API result
replaces that destination.

## If-node evaluation order

The shared handler evaluates exact provider information before broad HTTP status fallbacks.
For comparisons, convert `error.errorCode` to a string so both `1002` and `"1002"` match.
Preserve the original value for diagnostics and compare `error.code` exactly as supplied.

| Priority | Internal outcome | Match | Handling |
| ---: | --- | --- | --- |
| 1 | `CONFIG_SIGNATURE` | `errorCode == "1003"`, `code == "InvalidSignature"`, or `code == "INVALID_SIGNATURE"` | Stop automatic retry and route to configuration support. |
| 2 | `INSUFFICIENT_SCOPE` | `errorCode == "1005"` or `code == "InsufficientScope"` | Do not repeat the unchanged request; route to permission support. |
| 3 | `INPUT_INVALID` | `errorCode == "1001"`, `code == "InvalidInput"`, `code == "BOOTSTRAP_VALIDATION_FAILED"`, or otherwise unclassified status `400` | Return to the relevant input step. Never replay a write automatically. |
| 4 | `AUTH_RECOVERY` | `errorCode == "1002"` or `code == "AuthenticationFailed"` | Apply the operation-class rules below. |
| 5 | `SESSION_RECOVERY` | `errorCode == "1004"` or `code == "SessionInvalid"` | Reauthenticate; replay only when the operation is safe. |
| 6 | Status fallback | Unclassified `401`, `403`, `404`, or `409` | Route respectively to authentication, permission, refresh/reselect, or business-conflict handling. |
| 7 | `UNKNOWN_TECHNICAL` | Missing classification or any new provider code | Stop safely or use a bounded retry only when operation safety is known. |

The terminal default branch must not continue into a success path. The internal outcome
labels are flow-management values; they do not replace provider codes and must not be shown
to users.

### Context-sensitive authentication recovery

`AuthenticationFailed` / `1002` intentionally covers different situations. Route it by
`operationClass`:

| Operation class | Recovery |
| --- | --- |
| `otpVerify` | Use one neutral retry/resend path. Do not infer whether the number is unknown, the code is wrong or expired, attempts are exhausted, or the number is frozen. |
| `authentication` | Start a fresh OTP or SSO hand-off, with a bounded attempt count. |
| `protectedRead` | Reauthenticate once and replay the read once. If authentication fails again, stop rather than loop. |
| `protectedWrite` | Reauthenticate once, then refresh or check business state before any replay. The original write may have completed even when its response was not received. |

Apply the same read/write replay distinction to `SessionInvalid` / `1004`, status-only
authentication errors, and ambiguous network failures.

## User-message boundary

Provider values are for flow control and internal diagnostics only. Never render `code`,
`errorCode`, `status`, `traceId`, raw provider messages, or internal outcome labels in a Say
node. Choose an approved message for each internal outcome.

For Verify OTP `1002`, always use the same neutral behavior, for example: "That didn't
work. Shall I send a new code?" This anti-enumeration rule applies regardless of the actual
reason for failure.
