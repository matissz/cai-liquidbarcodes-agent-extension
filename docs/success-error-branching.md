# Success and Error Branching

## Result routing

Every Liquid Barcodes API node exposes these Cognigy mini children:

- **On Success** continues after a valid response has been stored in context.
- **On Error** continues after a normalized error and its internal classification have been stored in context.

The child descriptors are shared by the enabled API nodes. They represent execution outcomes, not endpoint-specific business states.

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
3. Store the common error envelope at `context.liquidBarcodesAgent.errorHandling.current`.
4. Select **On Error**. A native Cognigy If node can inspect the stored `outcome` value.

Context is deliberately retained. Branches control execution, while context provides response data, error classification, HTTP status, numeric `errorCode`, and `traceId` correlation where supplied by the provider.

## Compatibility

Newly created parent nodes declare only On Success and On Error as dependencies. Recreate
an existing API node in Cognigy if its generated children do not refresh after an upgrade.

Duplicate children are prevented by the descriptor contract in normal use. If malformed flow configuration contains duplicates, routing selects the first child with the expected descriptor type.

## Security boundary

The branch only describes whether the extension accepted a response as successful. In particular, **Start OTP: On Success** means the provider accepted a correctly formed request. It does not confirm that an account exists or that an SMS was delivered. This preserves Liquid Barcodes' OTP anti-enumeration behavior.

Detailed recovery belongs beneath On Error and may use a native If node to inspect the stored
classification. Do not expose raw provider messages, identifiers, or trace values directly to users.

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

New provider codes resolve to `technicalError` and remain available in context for flow-specific handling.

## Integrated error classifier

The extension stores this envelope before selecting an error outcome:

```json
{
  "operation": "verifyOtp",
  "operationClass": "otpVerify",
  "sourceContextKey": "liquidBarcodesAgent.session",
  "outcome": "authenticationFailed",
  "error": "{{context.liquidBarcodesAgent.session.error}}"
}
```

The extension replaces `context.liquidBarcodesAgent.errorHandling.current` on every failure
before routing to On Error.
`sourceContextKey` contains the node's configured **Store Result In** value.

Use these operation classes:

| Operation class | Use for |
| --- | --- |
| `otpVerify` | Verify OTP |
| `authentication` | Start OTP |
| `protectedRead` | Get User Profile |
| `protectedWrite` | Cancel Subscription |

Keep loop-control state separately at
`context.liquidBarcodesAgent.errorHandling.retryState`. At minimum track
`reauthAttempted`, `operationReplayAttempted`, and an OTP conversation attempt counter.
Reset the relevant state after recovery succeeds and when a new top-level user operation
begins. Do not store retry state inside an API result destination because a later API result
replaces that destination.

## Classification order

On Error evaluates exact provider information before broad HTTP status fallbacks.
For comparisons, convert `error.errorCode` to a string so both `1002` and `"1002"` match.
Preserve the original value for diagnostics and compare `error.code` exactly as supplied.

| Priority | Stored outcome | Match | Handling |
| ---: | --- | --- | --- |
| 1 | `invalidSignature` | `errorCode == "1003"`, `code == "InvalidSignature"`, or `code == "INVALID_SIGNATURE"` | Do not retry; check configuration, timestamp handling, and clock drift. |
| 2 | `insufficientScope` | `errorCode == "1005"` or `code == "InsufficientScope"` | Do not repeat the unchanged request; route to permission support. |
| 3 | `invalidInput` | `errorCode == "1001"`, `code == "InvalidInput"`, or `code == "BOOTSTRAP_VALIDATION_FAILED"` | Return to the relevant input step. Never replay a write automatically. |
| 4 | `authenticationFailed` | `errorCode == "1002"` or `code == "AuthenticationFailed"` | Reauthenticate once. If that also fails, stop rather than loop. |
| 5 | `sessionInvalid` | `errorCode == "1004"` or `code == "SessionInvalid"` | Recover the session; replay only when the operation is safe. |
| 6 | `badRequest` | Remaining status `400` | Handle an unclassified bad request safely. |
| 7 | `notFound` | Status `404` | Refresh source data or ask the user to select again. |
| 8 | `conflict` | Status `409` | Refresh business state before deciding what to do next. |
| 9 | `unauthorized` | Remaining status `401` | Treat as unclassified authorization failure, not as a specific LB code. |
| 10 | `forbidden` | Remaining status `403` | Treat as unclassified permission failure. |
| 11 | `technicalError` | Missing classification, network/server failure, or new provider code | Stop safely or use a bounded retry only when operation safety is known. |

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
