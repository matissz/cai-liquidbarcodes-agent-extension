import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { removeSubscriptionUserNode } from '../../nodes/removeSubscriptionUser';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(removeSubscriptionUserNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('removeSubscriptionUser node (DELETE /v1/subscriptions/{id}/users/{userId})', () => {
  test('calls DELETE with subscriptionId and userId in the path', async () => {
    mock.onDelete(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      userId: '7',
      contextKey: 'lb.removeUser',
    });

    await execute(params);

    expect(mock.history.delete.length).toBe(1);
    expect(mock.history.delete[0].url).toBe(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`);
  });

  test('signature = SHA256(timestamp + subscriptionId + userId + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onDelete(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      userId: '7',
      contextKey: 'lb.removeUser',
    });

    await execute(params);

    const expectedInput = fixedTime + '53848' + '7' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.delete[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header and no body', async () => {
    mock.onDelete(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      subscriptionId: '53848',
      userId: '7',
      contextKey: 'lb.removeUser',
    });

    await execute(params);

    expect(mock.history.delete[0].headers!['Authorization']).toBe('Bearer my-tok');
    expect(mock.history.delete[0].data).toBeUndefined();
  });

  test('stores success result in context', async () => {
    mock.onDelete(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`).reply(200, {});

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      userId: '7',
      contextKey: 'lb.removeUser',
    });

    await execute(params);

    expect(contextStore['lb.removeUser'].success).toBe(true);
  });

  test('handles API error', async () => {
    mock.onDelete(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users/7`).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      subscriptionId: '53848',
      userId: '7',
      contextKey: 'lb.removeUser',
    });

    await execute(params);

    expect(contextStore['lb.removeUser'].error).toBeDefined();
  });
});
