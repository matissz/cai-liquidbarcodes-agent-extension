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
|---|---:|---:|
| `InvalidInput` | `1001` | 400 |
| `AuthenticationFailed` | `1002` | 401 |
| `InvalidSignature` | `1003` | 401 |
| `SessionInvalid` | `1004` | 401 |
| `InsufficientScope` | `1005` | 403 |

The Agent API reference separately uses uppercase `BOOTSTRAP_VALIDATION_FAILED` and `INVALID_SIGNATURE` without numeric mappings. The guides previously used `AUTHENTICATION_FAILED`, but the provider source does not establish that spelling as an alias. The extension preserves upstream codes exactly and does not infer mappings between these vocabularies.

New provider codes do not require new child descriptors. They remain available in context beneath **On Error** for flow-specific handling.