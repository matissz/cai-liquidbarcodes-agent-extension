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
    [{ error: { message: 'server', status: 500 } }, 'technicalError'],
    [{ error: { message: 'network' } }, 'technicalError'],
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
      error,
    }, 'simple');
  });
});