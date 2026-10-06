# On Error If-Node Setup

Every enabled Liquid Barcodes API node creates two child branches:

```text
[Liquid Barcodes API node]
  |-- [On Success] --> normal flow
  +-- [On Error] --> [Cognigy If node] --> recovery or stop
```

The extension classifies the failure before selecting **On Error**. No Set Context node or
custom error child is required.

## Quick setup

1. Add a Liquid Barcodes API node to the Flow.
2. Connect its **On Success** child to the normal path.
3. Add a native Cognigy **If** node after **On Error**.
4. In the If node, compare the Liquid Barcodes numeric error code
  `{{context.liquidBarcodesAgent.errorHandling.current.error.errorCode}}`.
5. Enter one of the numeric values from the table below.
6. Connect the If and Else branches to the appropriate internal recovery or stop paths.

For example, to detect insufficient permissions:

```text
Value:    {{context.liquidBarcodesAgent.errorHandling.current.error.errorCode}}
Operator: equals
Compare:  1005
```

Chain another If node beneath Else only when the Flow needs another distinct recovery path.
Use the final Else branch as the controlled technical-error fallback.

## Liquid Barcodes error codes

HTTP status alone is not sufficiently granular: `1002`, `1003`, and `1004` all use HTTP
`401`. Route by `error.errorCode` first.

| `errorCode` | Provider `code` | HTTP | Stored `outcome` | Flow handling |
| ---: | --- | ---: | --- | --- |
| `1001` | `InvalidInput` | 400 | `invalidInput` | Correct the input. Do not replay a write automatically. |
| `1002` | `AuthenticationFailed` | 401 | `authenticationFailed` | Reauthenticate once. If that also fails, stop and use the configuration/support path. |
| `1003` | `InvalidSignature` | 401 | `invalidSignature` | Do not retry. Check API key, signature configuration, timestamp parsing, and clock drift (allowed window is +/-10 minutes). |
| `1004` | `SessionInvalid` | 401 | `sessionInvalid` | Recover the lost session. Replay only when the original operation is safe. |
| `1005` | `InsufficientScope` | 403 | `insufficientScope` | Do not repeat the unchanged request. Correct permissions or endpoint scope. |

The extension also stores explicit fallback outcomes when no recognized LB code is supplied:

| Stored `outcome` | Match |
| --- | --- |
| `badRequest` | HTTP 400 without recognized LB code |
| `unauthorized` | HTTP 401 without recognized LB code |
| `forbidden` | HTTP 403 without recognized LB code |
| `notFound` | HTTP 404 |
| `conflict` | HTTP 409 |
| `technicalError` | Network, server, missing, or unclassified failure |

The `outcome` field is convenient for flow logic, but `error.errorCode` is the authoritative
granular value for documented Liquid Barcodes errors. The API may supply `errorCode` as a
number or string; configure Cognigy comparisons accordingly.

## Stored error data

The full internal envelope is available at:

```text
{{context.liquidBarcodesAgent.errorHandling.current}}
```

Example:

```json
{
  "operation": "getUser",
  "operationClass": "protectedRead",
  "sourceContextKey": "liquidBarcodesAgent.user",
  "outcome": "insufficientScope",
  "error": {
    "message": "Insufficient scope.",
    "code": "InsufficientScope",
    "errorCode": 1005,
    "status": 403,
    "traceId": "provider-trace-id"
  }
}
```

The enabled nodes set these operation values automatically:

| Node | `operation` | `operationClass` |
| --- | --- | --- |
| Start OTP | `startOtp` | `authentication` |
| Verify OTP | `verifyOtp` | `otpVerify` |
| Get User Profile | `getUser` | `protectedRead` |
| Cancel Subscription | `cancelSubscription` | `protectedWrite` |

Use `operationClass` only when recovery differs by operation. For `1002`, reauthenticate at
most once; if reauthentication fails, do not loop. Never automatically replay Cancel
Subscription because the write may have completed even if its response was not received.

## Security

Use `outcome`, provider codes, status, trace IDs, and raw error messages only for internal
flow control and diagnostics. Do not show them to users. Verify OTP failures should always
use the same neutral user-facing message regardless of the underlying reason.

After installing a new extension version, delete and recreate existing API node instances
when Cognigy does not refresh their generated On Success and On Error children.
