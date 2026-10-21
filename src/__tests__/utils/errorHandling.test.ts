import {
  ERROR_HANDLING_CONTEXT_KEY,
  classifyApiError,
  storeApiError,
} from '../../utils/errorHandling';

describe('Liquid Barcodes error handling', () => {
  test.each([
    [{ error: { message: 'bad signature', errorCode: 1003 } }, 'invalidSignature'],
    [{ error: { message: 'bad signature', code: 'INVALID_SIGNATURE' } }, 'invalidSignature'],
    [{ error: { message: 'scope', errorCode: '1005' } }, 'insufficientScope'],
    [{ error: { message: 'input', code: 'BOOTSTRAP_VALIDATION_FAILED' } }, 'invalidInput'],
    [{ error: { message: 'auth', errorCode: 1002 } }, 'authenticationFailed'],
    [{ error: { message: 'session', code: 'SessionInvalid' } }, 'sessionInvalid'],
    [{ error: { message: 'bad request', status: 400 } }, 'badRequest'],
    [{ error: { message: 'missing', status: 404 } }, 'notFound'],
    [{ error: { message: 'conflict', status: 409 } }, 'conflict'],
    [{ error: { message: 'unauthorized', status: 401 } }, 'unauthorized'],
    [{ error: { message: 'forbidden', status: 403 } }, 'forbidden'],
    [{ error: { message: 'owner', errorCode: 91, status: 403 } }, 'notOwner'],
    [{ error: { message: 'missing', errorCode: '90', status: 404 } }, 'subscriptionNotFound'],
    [{ error: { message: 'dependency', errorCode: 1008, status: 502 } }, 'dependencyError'],
    [{ error: { message: 'unexpected', errorCode: 1009, status: 500 } }, 'unexpectedError'],
    [{ error: { message: 'limited', status: 429 } }, 'rateLimited'],
    [{ error: { message: 'timeout', transportFailure: 'timeout' } }, 'timeout'],
    [{ error: { message: 'network', transportFailure: 'network' } }, 'networkError'],
    [{ error: { message: 'server', status: 500 } }, 'technicalError'],
    [{ error: { message: 'unknown' } }, 'technicalError'],
    [undefined, 'technicalError'],
  ])('classifies %# into %s', (envelope, expected) => {
    expect(classifyApiError(envelope)).toBe(expected);
  });

  test.each([
    [1001, 'invalidInput'],
    [1002, 'authenticationFailed'],
    [1003, 'invalidSignature'],
    [1004, 'sessionInvalid'],
    [1005, 'insufficientScope'],
  ])('provider errorCode %s takes precedence over HTTP fallbacks', (errorCode, expected) => {
    expect(classifyApiError({
      error: { message: 'mixed', errorCode, status: 400 },
    })).toBe(expected);
  });

  test.each([
    [{ message: 'owner', errorCode: 91, status: 403 }, 'doNotRetry', undefined],
    [{ message: 'session', errorCode: 1004, status: 401 }, 'reauthenticateOnce', 1],
    [{ message: 'dependency', errorCode: 1008, status: 502 }, 'verifyStateBeforeRetry', undefined],
    [{ message: 'timeout', transportFailure: 'timeout' as const }, 'verifyStateBeforeRetry', undefined],
    [{ message: 'limited', status: 429, retryAfter: '30' }, 'retryAfter', undefined],
  ])('stores cancellation directive %s', (error, directive, maxAttempts) => {
    const addToContext = jest.fn();
    const envelope = storeApiError({ addToContext }, 'lb.cancel', 'cancelSubscription', 'protectedWrite', error);
    expect(envelope.directive).toBe(directive);
    expect(envelope.maxAttempts).toBe(maxAttempts);
  });

  test('stores both the local result and common envelope', () => {
    const addToContext = jest.fn();
    const error = { message: 'failed', status: 409 };

    storeApiError({ addToContext }, 'lb.cancel', 'cancelSubscription', 'protectedWrite', error);

    expect(addToContext).toHaveBeenNthCalledWith(1, 'lb.cancel', { error }, 'simple');
    expect(addToContext).toHaveBeenNthCalledWith(2, ERROR_HANDLING_CONTEXT_KEY, {
      operation: 'cancelSubscription',
      operationClass: 'protectedWrite',
      sourceContextKey: 'lb.cancel',
      outcome: 'conflict',
      directive: 'doNotRetry',
      error,
    }, 'simple');
  });
});