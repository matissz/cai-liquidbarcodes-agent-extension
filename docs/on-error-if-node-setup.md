# On Error and If Node Setup

This guide describes the Cognigy flow configuration to add after the Liquid Barcodes
extension is installed. The extension provides **On Success** and **On Error** children, but
it does not create or configure Cognigy **Set Context**, **Execute Flow**, or **If** nodes.

The setup in this document is intentionally left for later flow configuration. No extension
runtime change is required before building it.

## 1. How On Error works

Every Liquid Barcodes API node follows this sequence:

1. Call the configured API.
2. Store either the successful response or a normalized error at the node's configured
   **Store Result In** context path.
3. Continue through **On Success** or **On Error**.

For example, Verify OTP stores failures at
`context.liquidBarcodesAgent.session.error` by default:

```json
{
  "message": "Authentication failed.",
  "code": "AuthenticationFailed",
  "errorCode": 1002,
  "status": 401,
  "traceId": "provider-trace-id"
}
```

The **On Error** child is only the entry point into the failure path. It does not show the
error, create an If node, or choose a recovery action.

## 2. Target flow structure

Configure every API failure path as follows:

```text
Liquid Barcodes API node
├── On Success
│   └── Normal success flow
└── On Error
    └── Set Context: Map Liquid Barcodes Error
        └── Execute Flow: Handle Liquid Barcodes Error
```

Create one reusable flow named **Handle Liquid Barcodes Error**. Put the shared If-node
chain in that flow so the classification logic is maintained in one place.

```text
Handle Liquid Barcodes Error
└── If: Configuration or signature error?
    ├── Yes: Configuration support path
    └── No: If insufficient scope?
        ├── Yes: Permission support path
        └── No: If invalid input?
            ├── Yes: Return to input path
            └── No: If authentication failed?
                ├── Yes: Authentication recovery path
                └── No: If session invalid?
                    ├── Yes: Session recovery path
                    └── No: If known HTTP fallback?
                        ├── Yes: Status-specific handling
                        └── No: Unknown technical failure path
```

Each **No** child continues to the next If node. Each **Yes** child starts the handling for
the matched error class. The final **No** child is the mandatory unknown-error fallback.

## 3. Configure Set Context after On Error

Add **Set Context** immediately below each **On Error** child. Map the source error into:

```text
context.liquidBarcodesAgent.errorHandling.current
```

Create these four entries in Set Context:

| Context key | Value |
| --- | --- |
| `liquidBarcodesAgent.errorHandling.current.operation` | Operation value from the table below |
| `liquidBarcodesAgent.errorHandling.current.operationClass` | Operation class from the table below |
| `liquidBarcodesAgent.errorHandling.current.sourceContextKey` | Source context key from the table below |
| `liquidBarcodesAgent.errorHandling.current.error` | Error expression from the table below |

Map the four fields individually. This keeps `error` as an object when Cognigy evaluates the
context expression and avoids accidentally saving the complete envelope as a JSON string.

### Source mappings

| Extension node | `operation` | `operationClass` | `sourceContextKey` | Error expression |
| --- | --- | --- | --- | --- |
| Request SSO Token | `requestSsoToken` | `authentication` | `liquidBarcodesAgent.ssoToken` | `{{context.liquidBarcodesAgent.ssoToken.error}}` |
| Exchange SSO Token | `exchangeSsoToken` | `authentication` | `liquidBarcodesAgent.session` | `{{context.liquidBarcodesAgent.session.error}}` |
| Start OTP | `startOtp` | `authentication` | `liquidBarcodesAgent.otpStart` | `{{context.liquidBarcodesAgent.otpStart.error}}` |
| Verify OTP | `verifyOtp` | `otpVerify` | `liquidBarcodesAgent.session` | `{{context.liquidBarcodesAgent.session.error}}` |
| Get User Profile | `getUser` | `protectedRead` | `liquidBarcodesAgent.user` | `{{context.liquidBarcodesAgent.user.error}}` |
| Get Stores | `getStores` | `protectedRead` | `liquidBarcodesAgent.stores` | `{{context.liquidBarcodesAgent.stores.error}}` |
| Get Machine Status | `getMachineStatus` | `protectedRead` | `liquidBarcodesAgent.machineStatus` | `{{context.liquidBarcodesAgent.machineStatus.error}}` |
| Get Receipts | `getReceipts` | `protectedRead` | `liquidBarcodesAgent.receipts` | `{{context.liquidBarcodesAgent.receipts.error}}` |
| Get Subscription Users | `getSubscriptionUsers` | `protectedRead` | `liquidBarcodesAgent.subscriptionUsers` | `{{context.liquidBarcodesAgent.subscriptionUsers.error}}` |
| Add Subscription User | `addSubscriptionUser` | `protectedWrite` | `liquidBarcodesAgent.addSubscriptionUser` | `{{context.liquidBarcodesAgent.addSubscriptionUser.error}}` |
| Remove Subscription User | `removeSubscriptionUser` | `protectedWrite` | `liquidBarcodesAgent.removeSubscriptionUser` | `{{context.liquidBarcodesAgent.removeSubscriptionUser.error}}` |
| Cancel Subscription | `cancelSubscription` | `protectedWrite` | `liquidBarcodesAgent.cancelSubscription` | `{{context.liquidBarcodesAgent.cancelSubscription.error}}` |
| Set Plate Number | `setPlateNumber` | `protectedWrite` | `liquidBarcodesAgent.setPlateNumber` | `{{context.liquidBarcodesAgent.setPlateNumber.error}}` |
| Issue Coupon | `issueCoupon` | `protectedWrite` | `liquidBarcodesAgent.issueCoupon` | `{{context.liquidBarcodesAgent.issueCoupon.error}}` |

If an API node uses a custom **Store Result In** value, replace `sourceContextKey` and the
error expression with that custom path.

### Verify OTP example

For Verify OTP, configure Set Context as:

| Context key | Value |
| --- | --- |
| `liquidBarcodesAgent.errorHandling.current.operation` | `verifyOtp` |
| `liquidBarcodesAgent.errorHandling.current.operationClass` | `otpVerify` |
| `liquidBarcodesAgent.errorHandling.current.sourceContextKey` | `liquidBarcodesAgent.session` |
| `liquidBarcodesAgent.errorHandling.current.error` | `{{context.liquidBarcodesAgent.session.error}}` |

After Set Context, add **Execute Flow** and select **Handle Liquid Barcodes Error**.

## 4. Shared paths used by the If nodes

All If nodes in the shared handler read the same mapped object:

| Value | Context path |
| --- | --- |
| Provider code | `context.liquidBarcodesAgent.errorHandling.current.error.code` |
| Numeric provider code | `context.liquidBarcodesAgent.errorHandling.current.error.errorCode` |
| HTTP status | `context.liquidBarcodesAgent.errorHandling.current.error.status` |
| Trace identifier | `context.liquidBarcodesAgent.errorHandling.current.error.traceId` |
| Originating operation | `context.liquidBarcodesAgent.errorHandling.current.operation` |
| Operation class | `context.liquidBarcodesAgent.errorHandling.current.operationClass` |

Use `code`, `errorCode`, and `status` only for internal control flow. Keep `traceId` only for
approved diagnostics.

## 5. Configure the If chain

Create the If nodes in the order below. Earlier checks are more specific; later checks are
broad fallbacks. Reordering them can route a specific provider error to a generic HTTP path.

In each If node, combine the listed alternatives with **OR**. Connect **No** to the next If.
If Cognigy treats numbers and strings differently, add both numeric and string comparisons
for `errorCode`, for example `1003` and `"1003"`.

### If 1: Configuration or signature error

Match any of:

```text
error.errorCode equals 1003
OR error.errorCode equals "1003"
OR error.code equals "InvalidSignature"
OR error.code equals "INVALID_SIGNATURE"
```

**Yes:** Stop automatic retries and route to an internal configuration/support path.

**No:** Continue to If 2.

### If 2: Insufficient scope

Match any of:

```text
error.errorCode equals 1005
OR error.errorCode equals "1005"
OR error.code equals "InsufficientScope"
```

**Yes:** Do not repeat the unchanged request. Route to a permission/support path.

**No:** Continue to If 3.

### If 3: Invalid input

Match any of:

```text
error.errorCode equals 1001
OR error.errorCode equals "1001"
OR error.code equals "InvalidInput"
OR error.code equals "BOOTSTRAP_VALIDATION_FAILED"
OR error.status equals 400
```

**Yes:** Return to the relevant input step. Do not automatically replay a write.

**No:** Continue to If 4.

### If 4: Authentication failed

Match any of:

```text
error.errorCode equals 1002
OR error.errorCode equals "1002"
OR error.code equals "AuthenticationFailed"
```

**Yes:** Continue to the operation-class If chain in section 6.

**No:** Continue to If 5.

### If 5: Session invalid

Match any of:

```text
error.errorCode equals 1004
OR error.errorCode equals "1004"
OR error.code equals "SessionInvalid"
```

**Yes:** Reauthenticate once. Replay only when allowed by the operation-class rules in
section 6.

**No:** Continue to If 6.

### If 6: Known HTTP fallback

Match any remaining status:

```text
error.status equals 401
OR error.status equals 403
OR error.status equals 404
OR error.status equals 409
```

Add a secondary If chain under **Yes** when separate status handling is required:

| Status | Handling |
| ---: | --- |
| `401` | Authentication path with bounded retry |
| `403` | Permission/support path |
| `404` | Refresh source data and ask the user to select again |
| `409` | Refresh business state and use a safe conflict response |

**No:** Route to the unknown technical failure path.

### Final No: Unknown technical failure

This path includes network failures, missing classifications, and future provider codes.
Stop safely or use a bounded retry only when operation safety is known. Never connect this
path to the API operation's normal success continuation.

## 6. Configure authentication recovery by operation class

Under the **Yes** child of If 4, create another If chain using:

```text
context.liquidBarcodesAgent.errorHandling.current.operationClass
```

Configure it in this order:

### If A: OTP verification

```text
operationClass equals "otpVerify"
```

**Yes:** Use one neutral retry or resend path. Do not reveal whether the phone number is
unknown, the code is wrong or expired, attempts are exhausted, or the number is frozen.

Suitable user message:

```text
That didn't work. Shall I send a new code?
```

### If B: Authentication operation

```text
operationClass equals "authentication"
```

**Yes:** Start a fresh OTP or SSO hand-off with a bounded attempt count.

### If C: Protected read

```text
operationClass equals "protectedRead"
```

**Yes:** Reauthenticate once and replay the read once. If authentication fails again, stop
instead of creating a loop.

### Final No: Protected write

The remaining expected class is `protectedWrite`.

Reauthenticate once, then refresh or check current business state before deciding whether a
replay is safe. Do not automatically replay a write because the original request may have
completed even when its response was not received.

Apply the same read/write distinction to session errors and ambiguous network failures.

## 7. Retry-state configuration

Keep retry state separate from the mapped current error:

```text
context.liquidBarcodesAgent.errorHandling.retryState
```

Recommended fields are:

```json
{
  "reauthAttempted": false,
  "operationReplayAttempted": false,
  "otpAttempts": 0
}
```

Before reauthentication or replay, use an If node to check the corresponding flag. Set the
flag before making the retry. This prevents a repeated API failure from creating an endless
loop.

Reset the relevant flags:

- After recovery succeeds.
- Before a new top-level user operation begins.
- When the flow intentionally abandons the failed operation.

Do not keep retry state inside an API node's **Store Result In** destination because the next
API result replaces that object.

## 8. User-message and logging rules

Never place these values in a Say node or other conversational output:

- `code`
- `errorCode`
- `status`
- `traceId`
- Raw provider error messages
- Internal branch names

Use approved business-facing messages for users. Log only sanitized values through approved
diagnostics. Do not log API keys, salts, signatures, access tokens, OTPs, phone numbers, or
request and response bodies.

## 9. Setup checklist

- [ ] Create the **Handle Liquid Barcodes Error** reusable flow.
- [ ] Add Set Context beneath every Liquid Barcodes **On Error** child.
- [ ] Use the mapping row for the originating extension node.
- [ ] Add Execute Flow after Set Context and select the shared handler.
- [ ] Create the six ordered error-class If nodes.
- [ ] Connect every **No** child to the next If node.
- [ ] Connect the final **No** child to a safe technical fallback.
- [ ] Add the operation-class If chain under authentication recovery.
- [ ] Add retry-state checks before reauthentication or replay.
- [ ] Verify that protected writes are not replayed automatically.
- [ ] Verify that OTP `1002` always produces a neutral response.
- [ ] Verify that no provider diagnostics are shown to users.

## Related documentation

- [Success and Error Branching](success-error-branching.md)
- [Cognigy Flow Setup Guide](cognigy-flow-setup-guide.md)
- [Node Input and Output Reference](node-input-output-reference.md)
