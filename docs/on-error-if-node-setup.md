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

### What the flow designer should see

In the flow containing an extension API node, the designer creates only two nodes beneath
**On Error**:

```text
[Verify OTP]
  |
  +-- [On Success] --> normal signed-in flow
  |
  +-- [On Error]
        |
        +-- [Set Context: Map Verify OTP Error]
              |
              +-- [Execute Flow: Handle Liquid Barcodes Error]
```

The complete If tree belongs inside the reusable **Handle Liquid Barcodes Error** flow. Do
not duplicate all If nodes beneath every On Error child.

In the shared flow, arrange the If nodes vertically along their **No** branches:

```text
[If 1: Signature/configuration?]
  |-- Yes --> [Configuration support] --> [Stop/Return]
  +-- No
       |
       v
[If 2: Insufficient scope?]
  |-- Yes --> [Permission support] --> [Stop/Return]
  +-- No
       |
       v
[If 3: Invalid input?]
  |-- Yes --> [Return to relevant input] --> [Stop/Return]
  +-- No
       |
       v
[If 4: Authentication failed?]
  |-- Yes --> [Operation-class If tree]
  +-- No
       |
       v
[If 5: Session invalid?]
  |-- Yes --> [Bounded reauthentication/recovery]
  +-- No
       |
       v
[If 6: Known HTTP status?]
  |-- Yes --> [Status-specific If tree]
  +-- No  --> [Unknown technical failure] --> [Stop/Return]
```

The labels in square brackets are suggested node labels. **Stop/Return** means the path must
end or return a controlled result to the calling flow; it must not accidentally continue
into the original API success path.

### What the flow designer must create

| Location | Designer action | Purpose |
| --- | --- | --- |
| Under each API **On Error** | Add one Set Context node | Copy the node-specific error into one shared structure |
| After that Set Context | Add one Execute Flow node | Call **Handle Liquid Barcodes Error** |
| In the shared handler flow | Add six ordered If nodes | Classify provider code and HTTP status |
| Under authentication Yes | Add three operation-class If nodes | Select OTP, authentication, read, or write recovery |
| Before any retry | Add retry-state If and Set Context nodes | Prevent retry loops |
| At every terminal branch | Add controlled message, support, return, or stop nodes | Prevent failure paths from reaching success handling |

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

### Cancel Subscription example

For Cancel Subscription, configure Set Context as:

| Context key | Value |
| --- | --- |
| `liquidBarcodesAgent.errorHandling.current.operation` | `cancelSubscription` |
| `liquidBarcodesAgent.errorHandling.current.operationClass` | `protectedWrite` |
| `liquidBarcodesAgent.errorHandling.current.sourceContextKey` | `liquidBarcodesAgent.cancelSubscription` |
| `liquidBarcodesAgent.errorHandling.current.error` | `{{context.liquidBarcodesAgent.cancelSubscription.error}}` |

The resulting shared object should look like this during execution:

```json
{
  "operation": "cancelSubscription",
  "operationClass": "protectedWrite",
  "sourceContextKey": "liquidBarcodesAgent.cancelSubscription",
  "error": {
    "message": "Bearer token is missing, expired, or invalid.",
    "code": "SessionInvalid",
    "errorCode": 1004,
    "status": 401,
    "traceId": "provider-trace-id"
  }
}
```

This example follows the Session Invalid Yes branch. Because the operation class is
`protectedWrite`, the flow may reauthenticate once but must check current subscription state
before deciding whether cancellation can be attempted again.

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

### Full references versus shorthand

The condition examples below use shorthand such as `error.errorCode`. In Cognigy, select or
enter the full context reference:

```text
context.liquidBarcodesAgent.errorHandling.current.error.errorCode
```

Use this translation throughout the guide:

| Shorthand in this guide | Full value to reference in the If node |
| --- | --- |
| `error.code` | `context.liquidBarcodesAgent.errorHandling.current.error.code` |
| `error.errorCode` | `context.liquidBarcodesAgent.errorHandling.current.error.errorCode` |
| `error.status` | `context.liquidBarcodesAgent.errorHandling.current.error.status` |
| `operation` | `context.liquidBarcodesAgent.errorHandling.current.operation` |
| `operationClass` | `context.liquidBarcodesAgent.errorHandling.current.operationClass` |

For each condition, configure the If node conceptually as:

```text
Left value:  full context reference
Operator:    equals
Right value: expected code, numeric code, status, or operation class
```

For example, the Authentication Failed If contains one OR group:

```text
context.liquidBarcodesAgent.errorHandling.current.error.errorCode equals 1002
OR
context.liquidBarcodesAgent.errorHandling.current.error.errorCode equals "1002"
OR
context.liquidBarcodesAgent.errorHandling.current.error.code equals "AuthenticationFailed"
```

Use Cognigy's context-value or expression mode for the left side rather than entering the
path as plain text. Use literal-value mode for values such as `1002`, `401`, and
`AuthenticationFailed`. The exact control names can differ between Cognigy versions, but the
left side must resolve from Context and the right side must remain the comparison value.

### Confirm the mapping before building the If tree

Run one known failure and inspect Context in the interaction or debug view. Confirm that:

1. The original API destination contains an `error` object.
2. `context.liquidBarcodesAgent.errorHandling.current.error` contains the same object after
  Set Context.
3. `operation` and `operationClass` contain the expected literal strings.
4. `error.errorCode` is either a number or string and the If node accounts for its type.

If `current.error` contains text such as `"[object Object]"` or a quoted JSON document, the
Set Context mapping stored a string instead of the error object. Map the `error` field using
the direct context expression shown in the source-mapping table.

## 5. Configure the If chain

Create the If nodes in the order below. Earlier checks are more specific; later checks are
broad fallbacks. Reordering them can route a specific provider error to a generic HTTP path.

In each If node, combine the listed alternatives with **OR**. Connect **No** to the next If.
If Cognigy treats numbers and strings differently, add both numeric and string comparisons
for `errorCode`, for example `1003` and `"1003"`.

For every If node:

1. Add the first condition using the full Context reference from section 4.
2. Add the remaining alternatives to the same **OR** group.
3. Label the **Yes** child with the matched handling category.
4. Connect the **No** child to the next numbered If node.
5. Do not add a generic status condition before the provider-specific checks.

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
