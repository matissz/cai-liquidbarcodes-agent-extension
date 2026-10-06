export const ERROR_HANDLING_CONTEXT_KEY = 'liquidBarcodesAgent.errorHandling.current';

export type ErrorOutcome =
  | 'invalidInput'
  | 'authenticationFailed'
  | 'invalidSignature'
  | 'sessionInvalid'
  | 'insufficientScope'
  | 'badRequest'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'technicalError';
export type OperationClass = 'otpVerify' | 'authentication' | 'protectedRead' | 'protectedWrite';

export type NormalizedApiError = {
  message: string;
  code?: string;
  errorCode?: number | string;
  status?: number;
  traceId?: string;
};

export type ErrorHandlingEnvelope = {
  operation: string;
  operationClass: OperationClass;
  sourceContextKey: string;
  outcome: ErrorOutcome;
  error: NormalizedApiError;
};

type ContextApi = {
  addToContext?: (key: string, value: unknown, mode: 'simple' | 'array') => void;
};

export function storeApiError(
  api: ContextApi,
  contextKey: string,
  operation: string,
  operationClass: OperationClass,
  error: NormalizedApiError,
): ErrorHandlingEnvelope {
  const envelope: ErrorHandlingEnvelope = {
    operation,
    operationClass,
    sourceContextKey: contextKey,
    outcome: classifyApiError({ error }),
    error,
  };

  api.addToContext?.(contextKey, { error }, 'simple');
  api.addToContext?.(ERROR_HANDLING_CONTEXT_KEY, envelope, 'simple');

  return envelope;
}

export function classifyApiError(envelope: unknown): ErrorOutcome {
  const error = (envelope as Partial<ErrorHandlingEnvelope> | null)?.error;
  if (!error || typeof error !== 'object') {
    return 'technicalError';
  }

  const errorCode = error.errorCode === undefined || error.errorCode === null
    ? undefined
    : String(error.errorCode);
  const { code, status } = error;

  if (errorCode === '1003' || code === 'InvalidSignature' || code === 'INVALID_SIGNATURE') {
    return 'invalidSignature';
  }
  if (errorCode === '1005' || code === 'InsufficientScope') {
    return 'insufficientScope';
  }
  if (errorCode === '1001' || code === 'InvalidInput' || code === 'BOOTSTRAP_VALIDATION_FAILED') {
    return 'invalidInput';
  }
  if (errorCode === '1002' || code === 'AuthenticationFailed') {
    return 'authenticationFailed';
  }
  if (errorCode === '1004' || code === 'SessionInvalid') {
    return 'sessionInvalid';
  }
  if (status === 400) {
    return 'badRequest';
  }
  if (status === 404) {
    return 'notFound';
  }
  if (status === 409) {
    return 'conflict';
  }
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }

  return 'technicalError';
}
