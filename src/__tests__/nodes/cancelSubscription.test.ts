import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { cancelSubscriptionNode } from '../../nodes/cancelSubscription';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(cancelSubscriptionNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('cancelSubscription node (POST /v1/subscriptions/cancel)', () => {
  test('calls POST /v1/subscriptions/cancel', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(mock.history.post.length).toBe(1);
  });

  test('sends subscriptionId as a number in the body', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ subscriptionId: 53848 });
  });

  test('signature = SHA256(timestamp + subscriptionId + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    const expectedInput = fixedTime + '53848' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores success result in context', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(contextStore['lb.cancel']).toEqual({
      success: true,
      data: {},
      verification: {
        required: true,
        operation: 'getUser',
        directive: 'verifyStateBeforeRetry',
      },
    });
    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toBeNull();
  });

  test('logs every cancellation step without exposing credentials', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(200, {});

    const { params, logs } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'secret-bearer-token',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    const output = logs.map(entry => entry.message).join('\n');
    for (const event of [
      'lb.cancel.started',
      'lb.cancel.callingApi',
      'lb.request.prepared',
      'lb.request.sending',
      'lb.response.received',
      'lb.cancel.apiSucceeded',
      'lb.cancel.contextStored',
    ]) {
      expect(output).toContain(event);
    }
    expect(output).not.toContain(TEST_CONNECTION.apiKey);
    expect(output).not.toContain(TEST_CONNECTION.signatureSalt);
    expect(output).not.toContain('secret-bearer-token');
  });

  test('handles API error', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(400, {
      detail: 'Validation failed.',
      code: 'BOOTSTRAP_VALIDATION_FAILED',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '0',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(contextStore['lb.cancel'].error).toBeDefined();
  });

  test.each([
    [403, 'InvalidSubscriptionMemberId', 91, 'notOwner', 'doNotRetry'],
    [404, 'SubscriptionNotFound', 90, 'subscriptionNotFound', 'doNotRetry'],
    [401, 'SessionInvalid', 1004, 'sessionInvalid', 'reauthenticateOnce'],
    [502, 'DependencyError', 1008, 'dependencyError', 'verifyStateBeforeRetry'],
    [500, 'UnexpectedError', 1009, 'unexpectedError', 'verifyStateBeforeRetry'],
  ])('normalizes cancellation %s/%s', async (status, code, errorCode, outcome, directive) => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(status, {
      detail: 'Internal diagnostic only.', code, errorCode, status, traceId: 'trace-cancel',
    });
    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION, accessToken: 'tok', subscriptionId: '53848', contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      operation: 'cancelSubscription', operationClass: 'protectedWrite', outcome, directive,
    });
  });

  test('normalizes an uncertain network failure as state verification required', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).networkError();
    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION, accessToken: 'tok', subscriptionId: '53848', contextKey: 'lb.cancel',
    });

    await execute(params);

    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      outcome: 'networkError', directive: 'verifyStateBeforeRetry',
    });
  });

  test('logs API failure details and trace ID', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/cancel`)).reply(401, {
      detail: 'The request could not be authenticated.',
      code: 'AuthenticationFailed',
      status: 401,
      traceId: '00-cancel-trace-01',
    });

    const { params, logs } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'secret-bearer-token',
      subscriptionId: '53848',
      contextKey: 'lb.cancel',
    });

    await execute(params);

    const output = logs.map(entry => entry.message).join('\n');
    expect(output).toContain('lb.response.failed');
    expect(output).toContain('lb.cancel.apiFailed');
    expect(output).toContain('AuthenticationFailed');
    expect(output).toContain('00-cancel-trace-01');
    expect(output).not.toContain('secret-bearer-token');
  });
});
