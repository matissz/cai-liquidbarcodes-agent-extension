import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { cancelSubscriptionNode } from '../nodes/cancelSubscription';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

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

    expect(contextStore['lb.cancel'].success).toBe(true);
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
});
