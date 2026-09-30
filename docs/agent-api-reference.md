# Liquid Barcodes Agent API Reference

- **Version:** 1.0.0
- **OpenAPI:** 3.0.1
- **Sandbox URL:** `https://agent.api.sandbox.eu1.l-b.dev/`

> Production URL is provided separately by Liquid Barcodes for your environment.

> **Response casing note (observed 2026-07):** the sandbox currently returns JSON response
> bodies in **camelCase** (e.g. `accessToken`, `userId`, `plateNumber`), whereas the response
> examples in this document use PascalCase. Request bodies are camelCase in both. Confirm the
> authoritative production casing with Liquid Barcodes; consumers should not assume PascalCase.

---

## Authentication & Request Signing

Every request requires three standard headers plus a computed signature. Endpoints outside the **Authorization** group also require a Bearer token.

### Standard Headers (every request)

| Header | Required | Description |
|---|---|---|
| `X-Customer-Api-Key` | Yes | Your customer API key from Liquid Barcodes. Sent as a header only -- **not** included in the signed string. |
| `X-Liquid-Timestamp` | Yes | Request time in ISO 8601 (UTC recommended). Example: `2014-03-06T13:11:04+03:00` |
| `X-Liquid-Signature` | Yes | SHA-256 of the concatenated signing string, as **lowercase hexadecimal**. |

### Signature Salt

Liquid Barcodes provides a **signature salt** -- a separate secret used only when building the signed string. It is concatenated **last** (after the timestamp and any operation-specific values). It is **not** the same value as `X-Customer-Api-Key`.

### Bearer Token

- **Authorization endpoints** (SSO and OTP): use only the three headers above. Do **not** send `Authorization`.
- **All other endpoints**: also require `Authorization: Bearer {AccessToken}`, using the token returned by SSO exchange or OTP verify. The Bearer value is **not** part of the signed string.

### Computing `X-Liquid-Signature`

1. Concatenate with **no** separators (trim each part first):
   - `X-Liquid-Timestamp` value
   - Operation-specific values (see each endpoint below), in order
   - **Signature salt**
2. UTF-8 encode the resulting string.
3. Hash with SHA-256.
4. Write the digest as lowercase hexadecimal into `X-Liquid-Signature`.

---

## Endpoints

### Authorization

#### POST `/v1/auth/sso` -- Exchange SSO Token

Swap an in-app SSO token for an access token.

**Signature construction:** `timestamp` + `ssoToken` + `signatureSalt`

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `ssoToken` | string | Yes | One-time SSO token from the in-app flow. |

**Example request:**
```json
{
  "ssoToken": "Testtoken123"
}
```

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `AccessToken` | string | Bearer token for subsequent Agent API requests. |
| `ExpiresInSeconds` | integer | Time-to-live of the access token, in seconds. |

**Example response:**
```json
{
  "AccessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "ExpiresInSeconds": 3600
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### POST `/v1/auth/otp/start` -- Start OTP

Send an OTP by SMS to the given phone number. Then call Verify OTP with the code.

**Signature construction:** `timestamp` + `phone` + `signatureSalt`

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | Digits only, country code included, no leading `+`. |

**Example request:**
```json
{
  "phone": "34111111111"
}
```

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `Phone` | string | Echo of the phone that received the OTP. |

**Example response:**
```json
{
  "Phone": "34111111111"
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### POST `/v1/auth/otp/verify` -- Verify OTP

Send the SMS code and phone from the start step; receive an access token.

**Signature construction:** `timestamp` + `phone` + `code` + `signatureSalt`

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | Same phone used on start. |
| `code` | string | Yes | Code from the SMS. |

**Example request:**
```json
{
  "phone": "34111111111",
  "code": "3565"
}
```

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `AccessToken` | string | Bearer token for subsequent Agent API requests. |
| `ExpiresInSeconds` | integer | Time-to-live of the access token, in seconds. |

**Example response:**
```json
{
  "AccessToken": "RRSOIoKrxujjHOSdjtjfKZG0_7MrPCBXQzTExwtzLvI",
  "ExpiresInSeconds": 3600
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### User

#### GET `/v1/user` -- Get User

Profile of the signed-in user. Requires `Authorization: Bearer` token.

**Signature construction:** `timestamp` + `signatureSalt`

**Additional headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer {AccessToken}` from SSO or OTP verify. |

**Response 200:** Returns the [User Model](#user-model).

**Example response (normal subscription):**
```json
{
  "UserId": "ASTMXF80843FF14664040A349B0D066C790D6",
  "Msn": "1987654321",
  "Name": "Luke",
  "Surname": "Skywalker",
  "Address": "43 Example St.",
  "PostCode": "19999",
  "DeviceId": "0BA0AA8D3067BE7A674E55DD40B17340",
  "City": "Philadelphia",
  "Emails": ["luke.skywalker@example.com"],
  "DateOfBirth": "1985-12-31",
  "Gender": "M",
  "PreferredStores": [],
  "SelectedPreferredStores": [17581],
  "UserGroups": [
    {
      "GroupDescription": "Employees",
      "UserConfigurable": "Configurable",
      "GroupId": "Employees",
      "IsUserMember": false
    }
  ],
  "Culture": "en-US",
  "Consents": [
    {
      "Name": "Master",
      "State": "ConsentGiven",
      "Mandatory": true,
      "LastApproved": {
        "Id": 587789,
        "Title": "Master Consent",
        "PrivacyPolicyTitle": "Privacy",
        "Version": "0.1",
        "Description": "<p>Master consent body</p>\r\n",
        "PrivacyPolicy": "<p>Privacy Policy body</p>\r\n",
        "DefaultState": false,
        "MinimumAge": 0
      },
      "CurrentVersion": {
        "Id": 587789,
        "Title": "Master Consent",
        "PrivacyPolicyTitle": "Privacy",
        "Version": "0.1",
        "Description": "<p>Master consent body</p>\r\n",
        "PrivacyPolicy": "<p>Privacy Policy body</p>\r\n",
        "DefaultState": false,
        "MinimumAge": 0
      },
      "ChangeLog": []
    }
  ],
  "UserMyPage": "https://url.to.mypage.com/mypage?p=...",
  "RegistrationDate": "2022-01-26T13:31:37.0000000+00:00",
  "PaymentMethods": [],
  "ExternalIdentifiers": [
    {
      "Identifier": "ABC123456789",
      "Type": "CitizenID",
      "Name": "Citizen ID"
    }
  ],
  "Subscriptions": [
    {
      "PlanName": "Carwash Subscription (multisubscription) - 15.99$",
      "SubscriptionId": 53848,
      "SubscriptionState": "Active",
      "RenewalState": "RenewalSucceeded",
      "ContentId": 56093370,
      "IsMultiUserPlan": true,
      "MaxUsersAmount": 2,
      "PlanId": 3,
      "RenewalDate": "2024-03-07T04:59:59.0000000+00:00",
      "RenewalPrice": 30.0
    }
  ],
  "AgeVerifiedBy": []
}
```

**Example response (balance subscription):**
```json
{
  "Subscriptions": [
    {
      "PlanName": "EVC Subscription",
      "SubscriptionId": 53848,
      "SubscriptionState": "Active",
      "RenewalState": "SubscriptionStarted",
      "ContentId": 56093370,
      "IsMultiUserPlan": false,
      "MaxUsersAmount": 0,
      "PlanId": 1336,
      "RenewalDate": "2024-04-01T04:00:00.0000000+00:00",
      "PeriodBalanceTopUp": 100.0,
      "RollingAccumulationLimit": 50.0,
      "RollingAccumulationExpirationPeriodCount": 2,
      "MaximumBalanceLimit": 200.0,
      "CurrentBalance": 130.0,
      "AccumulatedBalance": 30.0
    }
  ]
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### Stores

#### GET `/v1/stores` -- Get Stores

List all stores, or pass `storeId` to get a single store.

**Signature construction:** `timestamp` + `storeId` + `signatureSalt`

> If `storeId` is omitted, concatenate only `timestamp` + `signatureSalt`.

**Additional headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer {AccessToken}` from SSO or OTP verify. |

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `storeId` | integer | No | Limits the result to the store with this Liquid internal ID. |

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `Stores` | array | List of [Store](#store-object) objects. |

**Example response:**
```json
{
  "Stores": [
    {
      "Id": 22632,
      "ExternalId": 1,
      "Name": "Store A",
      "ShortName": "Store A",
      "Address": "24 One St.",
      "Latitude": 0.117534515830831,
      "Longitude": -7.17132568359375,
      "CurrentState": "Open",
      "OpeningHours": [
        "9:00-18:00", "9:00-18:00", "9:00-18:00", "9:00-18:00",
        "9:00-18:00", "9:00-18:00", "9:00-18:00"
      ],
      "Note": "Comment for opening hours",
      "TagIds": "109"
    },
    {
      "Id": 22634,
      "ExternalId": 12132132,
      "Name": "Store C",
      "ShortName": "Store C",
      "Address": "2 Example St.",
      "Latitude": 0.00724151772265655,
      "Longitude": -0.00596858561038971,
      "CurrentState": "Open",
      "OpeningHours": [
        "9:00-18:00", "9:00-18:00", "9:00-18:00", "9:00-18:00",
        "9:00-18:00", "9:00-18:00", null
      ],
      "TagIds": "109",
      "Email": "test@barcodes.no",
      "Zip": "29010"
    }
  ]
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### GET `/v1/stores/machines/status` -- Get Stores Machines Status

Retrieve machine status for all stores. Optional `lastUpdateTime` filters to changes after that time.

**Signature construction:** `timestamp` + `lastUpdateTime` + `signatureSalt`

> If `lastUpdateTime` is omitted, concatenate only `timestamp` + `signatureSalt`.

**Additional headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer {AccessToken}` from SSO or OTP verify. |

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lastUpdateTime` | string | No | ISO 8601 datetime. Only returns statuses changed after this time. |

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `StoreMachinesStatus` | array | Array of [StoreMachineStatus](#storemachinestatus-object) objects. |

**Example response:**
```json
{
  "StoreMachinesStatus": [
    {
      "StoreId": 22632,
      "Status": "Available",
      "StoreMachines": [
        {
          "StoreMachineId": 46,
          "Name": "Carwash Machine",
          "MachineDeviceId": "1234",
          "Status": "Available",
          "MachineProvider": "X",
          "ActivationTypesAvailable": ["Trigger", "Code"]
        },
        {
          "StoreMachineId": 20,
          "Name": "Carwash Machine 2",
          "MachineDeviceId": "4321",
          "Status": "OutOfService",
          "MachineProvider": "X",
          "ActivationTypesAvailable": ["Trigger", "Code"]
        }
      ]
    }
  ]
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### Receipts

#### GET `/v1/receipts` -- Get Receipts

Retrieve user receipts. Optional `storeId` and `dateFrom` filters. May be slow -- use generous timeouts.

**Signature construction:** `timestamp` + `storeId` + `dateFrom` + `signatureSalt`

> Omit absent optional values from the concatenation.

**Additional headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer {AccessToken}` from SSO or OTP verify. |

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `storeId` | integer | No | Limits receipts to this store. Use the store ID from `GET /v1/stores`. |
| `dateFrom` | string | No | ISO 8601 datetime. Limits receipts to this datetime and forwards (e.g., last 6 months). |

**Response 200:**

| Field | Type | Description |
|---|---|---|
| `Logo` | string | URL to company logo. If a store needs a separate logo, it is available from `GET /v1/stores`. |
| `Receipts` | array | Array of [Receipt](#receipt-model) objects. |

**Example response:**
```json
{
  "Logo": "https://url.to.company.logo.jpg",
  "Receipts": [
    {
      "ReceiptId": "61f3d40428e943001fcff479",
      "Format": "Liquid/1.0",
      "Receipt": "{\"ReceiptId\":\"4771dc9e1331468388713498bfc64d48\",\"SubTotal\":1.50000,...}"
    }
  ]
}
```

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### Subscriptions

#### POST `/v1/subscriptions/cancel` -- Cancel Subscription

Cancel a user's subscription. Requires `Authorization: Bearer` token. Cancellation timing
(immediate vs. next renewal) should be confirmed with Liquid Barcodes.

**Signature construction:** `timestamp` + `subscriptionId` + `signatureSalt`

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `subscriptionId` | integer (int64) | Yes | The SubscriptionId to cancel (from `GET /v1/user`). |

**Response 200:** `OK` (no documented body).

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### GET `/v1/subscriptions/{subscriptionId}/users` -- Get Subscription Users

List the users (family members) on a multi-user subscription. Requires `Authorization: Bearer`.

**Signature construction:** `timestamp` + `subscriptionId` + `signatureSalt`

**Path parameters:** `subscriptionId` (integer int64, required).

**Response 200:** list of subscription users.

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### POST `/v1/subscriptions/{subscriptionId}/users` -- Add Subscription User

Add a user (family member) to a multi-user subscription (owner only, up to `MaxUsersAmount`).
Requires `Authorization: Bearer`.

**Signature construction:** `timestamp` + `subscriptionId` + `personalIdentifier` + `signatureSalt`

**Path parameters:** `subscriptionId` (integer int64, required).

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `personalIdentifier` | string | Yes | Identifier of the user to add (e.g. phone number). |

**Response 200:** `OK` (no documented body).

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

#### DELETE `/v1/subscriptions/{subscriptionId}/users/{id}` -- Remove Subscription User

Remove a user (family member) from a multi-user subscription. Requires `Authorization: Bearer`.

**Signature construction:** `timestamp` + `subscriptionId` + `id` + `signatureSalt`

**Path parameters:** `subscriptionId` (integer int64, required), `id` (integer int64, required --
the subscription user's Id from Get Subscription Users).

**Response 200:** `OK` (no documented body).

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### User Profile Updates

#### PUT `/v1/user/plate-number` -- Set Plate Number

Update the signed-in user's license plate number. Requires `Authorization: Bearer`.

**Signature construction:** `timestamp` + `plateNumber` + `signatureSalt`

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `plateNumber` | string | Yes | The new license plate number. |

**Response 200:** `OK` (no documented body).

> The Agent API also exposes granular profile-update endpoints not yet wrapped as nodes:
> `PATCH /v1/user`, `PATCH /v1/user/name`, `PATCH /v1/user/address`,
> `PUT /v1/user/{gender|culture|date-of-birth|emails|preferred-stores|default-payment-method}`,
> and `POST|DELETE /v1/user/{consents|groups}/{id}`.

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

### Coupons

#### POST `/v1/coupons/issue` -- Issue Coupon

Issue a coupon (e.g. a single wash code) to the signed-in user. Requires `Authorization: Bearer`.
Confirm `scheduleId` selection for a single car wash with Liquid Barcodes.

**Signature construction:** `timestamp` + `scheduleId` + `expirationDate?` + `transactionId?` + `signatureSalt`

> Omit absent optional values from the concatenation (same rule as the data endpoints).

**Request Body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `scheduleId` | integer (int32) | Yes | The coupon schedule ID to issue (provided by Liquid Barcodes). |
| `expirationDate` | string (date-time) | No | Expiration date/time for the issued coupon. |
| `transactionId` | string | No | Caller-supplied transaction reference. |

**Response 200:** `OK` (no documented body).

**Error responses:** [400](#error-response-400), [401](#error-response-401)

---

## Data Models

### User Model

Returned by `GET /v1/user`.

| Field | Type | Required | Description |
|---|---|---|---|
| `UserId` | string | Yes | User ID. For new users matches the request; for returning users, the ID previously associated with the MSN. |
| `Msn` | string | Yes | Mobile number. Country code (without `+`) + digits only. Example: `1987654321`. |
| `Name` | string | No | User's first name. |
| `Surname` | string | No | User's surname. |
| `Address` | string | No | User's address. |
| `PostCode` | string | No | User's zip code. |
| `DeviceId` | string | No | User's device identifier. |
| `City` | string | No | User's city of residence. |
| `Emails` | string[] | No | Array of user's email addresses. |
| `DateOfBirth` | string | No | Date of birth in ISO 8601 format (`yyyy-mm-dd`). |
| `Gender` | string | No | `M`, `F`, `O`, or empty string. |
| `PreferredStores` | integer[] | No | System-determined preferred store IDs, ordered by preference. |
| `SelectedPreferredStores` | integer[] | No | User-selected preferred store IDs, ordered by preference. |
| `UserGroups` | [UserGroup](#usergroup-object)[] | No | Array of user group memberships. |
| `Culture` | string | No | User's culture/language (RFC 4646). |
| `Consents` | [ConsentSituation](#consentsituation-object)[] | Yes | Applicable consents. Mandatory consents must be approved before registration. Empty if external consent handling is used. |
| `UserMyPage` | string | Yes | Link to HTML page with advanced settings. PIN sent via SMS (if MSN present) or email. Empty if neither exists. |
| `RegistrationDate` | string | Yes | ISO 8601 UTC date/time of user registration. |
| `PaymentMethods` | [PaymentMethod](#paymentmethod-object)[] | No | Registered payment methods. First in array is the default. |
| `PlateNumber` | [PlateNumber](#platenumber-object) | No | User's license plate information. |
| `ExternalIdentifiers` | [ExternalIdentifier](#externalidentifier-object)[] | No | External identifiers for this user. |
| `Subscriptions` | [Subscription](#subscription-object)[] | Yes | User's subscriptions. Empty array if none. |
| `ReferralCode` | string | No | 6-character uppercase alphanumeric referral code, unique per user. Populated if configured. |
| `AgeVerifiedBy` | string[] | Yes | Collection of age verification services that confirmed the user's age. |

### UserGroup Object

| Field | Type | Required | Description |
|---|---|---|---|
| `GroupId` | string | Yes | Unique identifier for this group. |
| `GroupDescription` | string | Yes | Human-readable description displayed to the user. |
| `IsUserMember` | boolean | Yes | Whether the user is a member of this group. |
| `UserConfigurable` | string | Yes | See [UserConfigurable enum](#userconfigurable). |

### ConsentSituation Object

| Field | Type | Required | Description |
|---|---|---|---|
| `Name` | string | Yes | Consent name (e.g., "Master"). |
| `State` | string | Yes | Consent state (e.g., "ConsentGiven"). |
| `Mandatory` | boolean | Yes | Whether this consent must be approved before registration. |
| `LastApproved` | [ConsentVersion](#consentversion-object) | No | The version the user last approved. |
| `CurrentVersion` | [ConsentVersion](#consentversion-object) | No | The currently active version. |
| `ChangeLog` | array | No | History of consent state changes. |

### ConsentVersion Object

| Field | Type | Required | Description |
|---|---|---|---|
| `Id` | integer | Yes | Consent version ID. |
| `Title` | string | Yes | Consent title. |
| `PrivacyPolicyTitle` | string | Yes | Privacy policy title. |
| `Version` | string | Yes | Version string (e.g., "0.1"). |
| `Description` | string | Yes | Consent body (may contain HTML). |
| `PrivacyPolicy` | string | Yes | Privacy policy body (may contain HTML). |
| `DefaultState` | boolean | Yes | Default consent state. |
| `MinimumAge` | integer | Yes | Minimum age requirement (0 = no restriction). |

### PaymentMethod Object

| Field | Type | Required | Description |
|---|---|---|---|
| `Id` | integer | Yes | Payment method ID. |
| `Title` | string | Yes | Descriptive title shown to the user (e.g., "MasterCard ending in 1234"). |
| `PaymentProvider` | string | Yes | Payment provider name. |
| `PaymentProviderId` | string | Yes | Payment provider's unique identifier. |
| `Default` | boolean | Yes | Whether this is the default payment method for purchases and subscription renewals. |

### PlateNumber Object

| Field | Type | Required | Description |
|---|---|---|---|
| `Id` | integer | Yes | Plate number ID. |
| `PlateNumber` | string | Yes | The plate number. |
| `Title` | string | Yes | Title for the plate number. |

### ExternalIdentifier Object

| Field | Type | Required | Description |
|---|---|---|---|
| `Identifier` | string | No | The external identifier string. |
| `Type` | string | Yes | Identifier type. Supported: `MacauPass`, `CitizenID`, `LoyaltyID`, `PumaFastPayID`. |
| `Name` | string | Yes | Human-readable localized name displayed to the user. |

### Subscription Object

| Field | Type | Required | Description |
|---|---|---|---|
| `PlanName` | string | Yes | Name of the subscription plan (e.g., "Car wash Gold"). |
| `SubscriptionId` | integer | Yes | Subscription ID. |
| `SubscriptionState` | string | Yes | See [SubscriptionState enum](#subscriptionstate). |
| `RenewalState` | string | Yes | See [RenewalState enum](#renewalstate). |
| `ContentId` | integer | Yes | ContentId associated with this subscription (can change). |
| `IsMultiUserPlan` | boolean | Yes | Whether the plan allows extra users. |
| `MaxUsersAmount` | integer | Yes | Max extra users (excludes the subscription owner). |
| `PlanId` | integer | Yes | Subscription plan unique identifier. |
| `RenewalDate` | string | No | Next auto-renewal date (ISO 8601). |
| `RenewalPrice` | number | No | Price on next renewal, accounting for downgrades, rebates, and promotions. |
| `DelayedStartDate` | string | No | UTC date/time when the subscription activates. Mandatory when `SubscriptionState` is `ToActivateWithDelay`. |
| `PeriodBalanceTopUp` | number | No | Units (e.g., kWh) added on monthly renewal. Balance subscriptions only. |
| `RollingAccumulationLimit` | number | No | Max unused units that can roll over from previous period. |
| `RollingAccumulationExpirationPeriodCount` | integer | No | Period count for accumulated unit expiration (e.g., 2 months). |
| `MaximumBalanceLimit` | number | No | Maximum total balance for this subscription. |
| `CurrentBalance` | number | No | Total available units at this moment. |
| `AccumulatedBalance` | number | No | Units rolled over from the previous period. |

### Store Object

Returned in the `Stores` array from `GET /v1/stores`.

| Field | Type | Required | Description |
|---|---|---|---|
| `Id` | integer | Yes | Liquid internal ID. |
| `ExternalId` | integer | Yes | External (customer's) ID. |
| `Name` | string | Yes | Store name. |
| `ShortName` | string | Yes | Shortened store name. |
| `Address` | string | Yes | Store address. |
| `Telephone` | string | Yes | Store phone number. |
| `Latitude` | number | Yes | Geolocation latitude. |
| `Longitude` | number | Yes | Geolocation longitude. |
| `CurrentState` | string | Yes | See [StoreState enum](#storestate). |
| `OpeningHours` | string[] | No | 7 entries (Monday-Sunday), each `"HH:MM-HH:MM"`. `null` if closed that day. |
| `Note` | string | No | Special announcements (e.g., "Closed on Monday due to public holidays"). |
| `TagIds` | string | No | Comma-separated list of tag IDs used to group stores. |
| `Metadata` | string | No | Comma-separated `key:value` pairs. Ignore unrecognized keys. |
| `Logo` | string | No | URL to store logo (if different from company logo). |
| `Email` | string | No | Store email address. |
| `Zip` | string | No | Store zip code. |
| `City` | string | No | Store city. |

### StoreMachineStatus Object

Returned in the `StoreMachinesStatus` array from `GET /v1/stores/machines/status`.

| Field | Type | Required | Description |
|---|---|---|---|
| `StoreId` | integer | Yes | Liquid Barcodes store identifier (from `GET /v1/stores`). |
| `Status` | string | Yes | Aggregate store status: `Available` if any machine is available; `OutOfService` if all are out of service. |
| `StoreMachines` | [StoreMachine](#storemachine-object)[] | Yes | Array of individual machine statuses. |

### StoreMachine Object

| Field | Type | Required | Description |
|---|---|---|---|
| `StoreMachineId` | integer | Yes | Machine ID. |
| `Name` | string | Yes | Machine name. |
| `MachineDeviceId` | string | Yes | Machine device ID. |
| `Status` | string | Yes | See [MachineStatus enum](#machinestatus). |
| `MachineProvider` | string | Yes | Machine provider name. |
| `ActivationTypesAvailable` | string[] | Yes | Supported activation types: `Code`, `Trigger`. |

### Receipt Model

Returned in the `Receipts` array from `GET /v1/receipts`.

| Field | Type | Required | Description |
|---|---|---|---|
| `ReceiptId` | string | Yes | Receipt record ID. |
| `Format` | string | Yes | Receipt format (e.g., `Liquid/1.0`). |
| `Receipt` | string | No | JSON string of the full receipt for the transaction. Must be parsed from the escaped string. |

### Error Response (RFC 9110 Problem Details)

Returned on **400** and **401** responses across all endpoints.

<a id="error-response-400"></a>
<a id="error-response-401"></a>

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | URI reference identifying the problem type (RFC 9110). |
| `title` | string | Yes | Short, human-readable summary. |
| `status` | integer | Yes | HTTP status code for this occurrence. |
| `detail` | string | Yes | Human-readable explanation specific to this occurrence. |
| `instance` | string | Yes | URI reference identifying the specific occurrence (often the request path). |
| `code` | string | Yes | Application-specific machine-readable error code. |
| `traceId` | string | Yes | Correlation identifier for diagnostics. |

**Known error codes:**

| Code | Status | Meaning |
|---|---|---|
| `BOOTSTRAP_VALIDATION_FAILED` | 400 | Request could not be validated. |
| `INVALID_SIGNATURE` | 401 | Signature is invalid or timestamp is not acceptable. |

**Example 400:**
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Validation failed.",
  "status": 400,
  "detail": "The request could not be validated.",
  "instance": "/v1/auth/sso",
  "code": "BOOTSTRAP_VALIDATION_FAILED",
  "traceId": "00-93b74cb6223b5c933bc5d44907b64900-1294bbeaaa95f748-00"
}
```

**Example 401:**
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "Authentication failed.",
  "status": 401,
  "detail": "The request signature is invalid or the request timestamp is not acceptable.",
  "instance": "/v1/auth/sso",
  "code": "INVALID_SIGNATURE",
  "traceId": "00-2eb7f60e8c1217423b6a1f0a6bea90a4-e584f258e78c4497-00"
}
```

---

## Enums Reference

### StoreState

| Value | Description |
|---|---|
| `Open` | The store is open for business. |
| `Closed` | The store is not open for business. |
| `TemporarilyClosed` | Not open but will reopen in the future. |
| `PermanentlyClosed` | The store is no longer operational. |

### MachineStatus

| Value | Description |
|---|---|
| `Available` | Machine is available. |
| `OutOfService` | Machine is out of service. |
| `Offline` | Machine is offline. |

### SubscriptionState

| Value | Description |
|---|---|
| `Active` | Subscription is active. |
| `Downgrading` | Subscription is in the process of downgrading. |
| `Cancelled` | Subscription has been cancelled. |
| `ToActivateWithDelay` | Subscription will activate at `DelayedStartDate`. |

### RenewalState

| Value | Description |
|---|---|
| `SubscriptionStarted` | After subscription start, before first renewal. Monthly limit not reached. |
| `RenewalSucceeded` | After a successful renewal. Monthly limit not reached. |
| `MonthlyLimitReached` | Active but associated coupon is depleted. |
| `RenewingInProgress` | Renewal in progress (up to 3 days, includes retries). No coupon at this point. |
| `ToActivateWithDelay` | Start date is in the future. |

### UserConfigurable

| Value | Description |
|---|---|
| `NotConfigurable` | User cannot toggle membership. **Default for unrecognized values.** |
| `Configurable` | User can change group membership. |
| `CodeConfigurable` | User can change membership but must enter an additional code. |

### ActivationType

| Value | Description |
|---|---|
| `Code` | Activation via code. |
| `Trigger` | Activation via trigger. |

---

## Signature Construction Quick Reference

| Endpoint | Concatenation Order |
|---|---|
| `POST /v1/auth/sso` | `timestamp` + `ssoToken` + `salt` |
| `POST /v1/auth/otp/start` | `timestamp` + `phone` + `salt` |
| `POST /v1/auth/otp/verify` | `timestamp` + `phone` + `code` + `salt` |
| `GET /v1/user` | `timestamp` + `salt` |
| `GET /v1/stores` | `timestamp` + `storeId` + `salt` |
| `GET /v1/stores/machines/status` | `timestamp` + `lastUpdateTime` + `salt` |
| `GET /v1/receipts` | `timestamp` + `storeId` + `dateFrom` + `salt` |
| `POST /v1/subscriptions/cancel` | `timestamp` + `subscriptionId` + `salt` |
| `GET /v1/subscriptions/{id}/users` | `timestamp` + `subscriptionId` + `salt` |
| `POST /v1/subscriptions/{id}/users` | `timestamp` + `subscriptionId` + `personalIdentifier` + `salt` |
| `DELETE /v1/subscriptions/{id}/users/{userId}` | `timestamp` + `subscriptionId` + `userId` + `salt` |
| `PUT /v1/user/plate-number` | `timestamp` + `plateNumber` + `salt` |
| `POST /v1/coupons/issue` | `timestamp` + `scheduleId` + `expirationDate` + `transactionId` + `salt` |

> For all signatures: trim each part, concatenate with **no** separators, UTF-8 encode, SHA-256 hash, output as lowercase hex. Omit absent optional values from the concatenation.
>
> The signature orders for the six write endpoints above were **verified against the sandbox**
> (each returns a non-`INVALID_SIGNATURE` response). See `src/__tests__/integration/live-agent-api.test.ts`.
