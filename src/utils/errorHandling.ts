export const ERROR_HANDLING_CONTEXT_KEY = 'liquidBarcodesAgent.errorHandling.current';

export type ErrorOutcome =
  | 'invalidInput' | 'authenticationFailed' | 'invalidSignature' | 'sessionInvalid'
  | 'insufficientScope' | 'notOwner' | 'subscriptionNotFound' | 'dependencyError'
  | 'unexpectedError' | 'rateLimited' | 'badRequest' | 'unauthorized' | 'forbidden'
  | 'notFound' | 'conflict' | 'timeout' | 'networkError' | 'technicalError';
export type OperationClass = 'otpVerify' | 'authentication' | 'appAuthentication' | 'protectedRead' | 'protectedWrite';
export type RecoveryDirective = 'none' | 'reauthenticateOnce' | 'verifyStateBeforeRetry' | 'doNotRetry' | 'retryAfter';

export type NormalizedApiError = {
  message: string;
  detail?: string;
  code?: string;
  errorCode?: number | string;
  status?: number;
  instance?: string;
  traceId?: string;
  transportFailure?: 'timeout' | 'network';
  retryAfter?: string | number;
};

export type ErrorHandlingEnvelope = {
  operation: string;
  operationClass: OperationClass;
  sourceContextKey: string;
  outcome: ErrorOutcome;
  directive: RecoveryDirective;
  maxAttempts?: number;
  error: NormalizedApiError;
};

type ContextApi = {
  addToContext?: (key: string, value: unknown, mode: 'simple' | 'array') => void;
};

export function clearApiError(api: ContextApi): void {
  api.addToContext?.(ERROR_HANDLING_CONTEXT_KEY, null, 'simple');
}

export function storeApiError(
  api: ContextApi,
  contextKey: string,
  operation: string,
  operationClass: OperationClass,
  error: NormalizedApiError,
): ErrorHandlingEnvelope {
  const outcome = classifyApiError({ error });
  const directive = recoveryDirective(operation, outcome, error);
  const envelope: ErrorHandlingEnvelope = {
    operation,
    operationClass,
    sourceContextKey: contextKey,
    outcome,
    directive,
    ...(directive === 'reauthenticateOnce' ? { maxAttempts: 1 } : {}),
    error,
  };

  api.addToContext?.(contextKey, { error }, 'simple');
  api.addToContext?.(ERROR_HANDLING_CONTEXT_KEY, envelope, 'simple');
  return envelope;
}

function recoveryDirective(operation: string, outcome: ErrorOutcome, error: NormalizedApiError): RecoveryDirective {
  if (outcome === 'authenticationFailed' || outcome === 'sessionInvalid' || outcome === 'unauthorized') return 'reauthenticateOnce';
  if (outcome === 'rateLimited') return 'retryAfter';
  if (operation === 'cancelSubscription' && (
    outcome === 'timeout' || outcome === 'networkError' || outcome === 'dependencyError' ||
    outcome === 'unexpectedError' || error.status === 500 || error.status === 502
  )) return 'verifyStateBeforeRetry';
  if (['invalidInput', 'invalidSignature', 'insufficientScope', 'notOwner', 'subscriptionNotFound',
    'badRequest', 'forbidden', 'notFound', 'conflict'].includes(outcome)) return 'doNotRetry';
  return 'none';
}

export function classifyApiError(envelope: unknown): ErrorOutcome {
  const error = (envelope as Partial<ErrorHandlingEnvelope> | null)?.error;
  if (!error || typeof error !== 'object') return 'technicalError';

  const errorCode = error.errorCode == null ? undefined : String(error.errorCode);
  const code = error.code;
  if (errorCode === '91' || code === 'InvalidSubscriptionMemberId') return 'notOwner';
  if (errorCode === '90' || code === 'SubscriptionNotFound') return 'subscriptionNotFound';
  if (errorCode === '1008' || code === 'DependencyError') return 'dependencyError';
  if (errorCode === '1009' || code === 'UnexpectedError') return 'unexpectedError';
  if (errorCode === '1003' || code === 'InvalidSignature' || code === 'INVALID_SIGNATURE') return 'invalidSignature';
  if (errorCode === '1005' || code === 'InsufficientScope') return 'insufficientScope';
  if (errorCode === '1001' || code === 'InvalidInput' || code === 'BOOTSTRAP_VALIDATION_FAILED') return 'invalidInput';
  if (errorCode === '1002' || code === 'AuthenticationFailed') return 'authenticationFailed';
  if (errorCode === '1004' || code === 'SessionInvalid') return 'sessionInvalid';
  if (error.transportFailure === 'timeout') return 'timeout';
  if (error.transportFailure === 'network') return 'networkError';
  if (error.status === 429) return 'rateLimited';
  if (error.status === 400) return 'badRequest';
  if (error.status === 404) return 'notFound';
  if (error.status === 409) return 'conflict';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 403) return 'forbidden';
  return 'technicalError';
}
