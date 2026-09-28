// ── Auth ──

export interface ISsoTokenRequest {
  UserId: string;
}

export interface ISsoTokenResponse {
  Token?: string;
  token?: string;
  ExpirationDate?: string;
  expirationDate?: string;
}

export interface ISsoRequest {
  ssoToken: string;
}

export interface ISsoResponse {
  AccessToken?: string;
  accessToken?: string;
  ExpiresInSeconds?: number;
  expiresInSeconds?: number;
}

export interface IOtpStartRequest {
  phone: string;
}

export interface IOtpStartResponse {
  Phone?: string;
  phone?: string;
}

export interface IOtpVerifyRequest {
  phone: string;
  code: string;
}

export interface IOtpVerifyResponse {
  AccessToken?: string;
  accessToken?: string;
  ExpiresInSeconds?: number;
  expiresInSeconds?: number;
}

// ── User ──

export interface IUserGroup {
  GroupId: string;
  GroupDescription: string;
  IsUserMember: boolean;
  UserConfigurable: string;
}

export interface IConsentVersion {
  Id: number;
  Title: string;
  PrivacyPolicyTitle: string;
  Version: string;
  Description: string;
  PrivacyPolicy: string;
  DefaultState: boolean;
  MinimumAge: number;
}

export interface IConsentSituation {
  Name: string;
  State: string;
  Mandatory: boolean;
  LastApproved?: IConsentVersion;
  CurrentVersion?: IConsentVersion;
  ChangeLog?: any[];
}

export interface IPaymentMethod {
  Id: number;
  Title: string;
  PaymentProvider: string;
  PaymentProviderId: string;
  Default: boolean;
}

export interface IPlateNumber {
  Id: number;
  PlateNumber: string;
  Title: string;
}

export interface IExternalIdentifier {
  Identifier?: string;
  Type: string;
  Name: string;
}

export interface ISubscription {
  PlanName: string;
  SubscriptionId: number;
  SubscriptionState: string;
  RenewalState: string;
  ContentId: number;
  IsMultiUserPlan: boolean;
  MaxUsersAmount: number;
  PlanId: number;
  RenewalDate?: string;
  RenewalPrice?: number;
  DelayedStartDate?: string;
  PeriodBalanceTopUp?: number;
  RollingAccumulationLimit?: number;
  RollingAccumulationExpirationPeriodCount?: number;
  MaximumBalanceLimit?: number;
  CurrentBalance?: number;
  AccumulatedBalance?: number;
}

export interface IUserResponse {
  UserId: string;
  Msn: string;
  Name?: string;
  Surname?: string;
  Address?: string;
  PostCode?: string;
  DeviceId?: string;
  City?: string;
  Emails?: string[];
  DateOfBirth?: string;
  Gender?: string;
  PreferredStores?: number[];
  SelectedPreferredStores?: number[];
  UserGroups?: IUserGroup[];
  Culture?: string;
  Consents: IConsentSituation[];
  UserMyPage: string;
  RegistrationDate: string;
  PaymentMethods?: IPaymentMethod[];
  PlateNumber?: IPlateNumber;
  ExternalIdentifiers?: IExternalIdentifier[];
  Subscriptions: ISubscription[];
  ReferralCode?: string;
  AgeVerifiedBy: string[];
}

// ── Stores ──

export interface IStore {
  Id: number;
  ExternalId: number;
  Name: string;
  ShortName: string;
  Address: string;
  Telephone?: string;
  Latitude: number;
  Longitude: number;
  CurrentState: string;
  OpeningHours?: (string | null)[];
  Note?: string;
  TagIds?: string;
  Metadata?: string;
  Logo?: string;
  Email?: string;
  Zip?: string;
  City?: string;
}

export interface IStoresResponse {
  Stores?: IStore[];
  stores?: IStore[];
}

export interface IStoreMachine {
  StoreMachineId: number;
  Name: string;
  MachineDeviceId: string;
  Status: string;
  MachineProvider: string;
  ActivationTypesAvailable: string[];
}

export interface IStoreMachineStatus {
  StoreId: number;
  Status: string;
  StoreMachines: IStoreMachine[];
}

export interface IStoreMachinesStatusResponse {
  StoreMachinesStatus?: IStoreMachineStatus[];
  storeMachinesStatus?: IStoreMachineStatus[];
}

// ── Receipts ──

export interface IReceipt {
  ReceiptId: string;
  Format: string;
  Receipt?: string;
}

export interface IReceiptsResponse {
  Logo?: string;
  logo?: string;
  Receipts?: IReceipt[];
  receipts?: IReceipt[];
}

// ── Subscription management ──

export interface ICancelSubscriptionRequest {
  subscriptionId: number;
}

export interface ISubscriptionUser {
  Id?: number;
  PersonalIdentifier?: string;
  Name?: string;
  [key: string]: any;
}

export interface ISubscriptionUsersResponse {
  Users?: ISubscriptionUser[];
  users?: ISubscriptionUser[];
  [key: string]: any;
}

export interface IAddSubscriptionUserRequest {
  personalIdentifier: string;
}

// ── Profile updates ──

export interface ISetPlateNumberRequest {
  plateNumber: string;
}

// ── Coupons ──

export interface IIssueCouponRequest {
  scheduleId: number;
  expirationDate?: string;
  transactionId?: string;
}

/** Endpoints that return `200 OK` with no documented response body. */
export interface IWriteOperationResult {
  [key: string]: any;
}

// ── Error ──

export interface IApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
}

// ── HTTP Client ──

export interface IAgentApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  baseUrl: string;
  path: string;
  apiKey: string;
  signatureSalt: string;
  signatureFields: string[];
  accessToken?: string;
  body?: Record<string, any>;
  queryParams?: Record<string, string>;
  log?: (level: 'info' | 'error', message: string) => void;
}

export interface IAgentApiResponse<T = any> {
  data: T;
  status: number;
}
