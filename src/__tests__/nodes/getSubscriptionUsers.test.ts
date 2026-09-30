import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getSubscriptionUsersNode } from '../../nodes/getSubscriptionUsers';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(getSubscriptionUsersNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const MOCK_USERS = { Users: [{ Id: 1, PersonalIdentifier: '34111111111' }] };

describe('getSubscriptionUsers node (GET /v1/subscriptions/{id}/users)', () => {
  test('calls GET /v1/subscriptions/{id}/users with the id in the path', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, MOCK_USERS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.subUsers',
    });

    await execute(params);

    expect(mock.history.get.length).toBe(1);
    expect(mock.history.get[0].url).toBe(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`);
  });

  test('signature = SHA256(timestamp + subscriptionId + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, MOCK_USERS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.subUsers',
    });

    await execute(params);

    const expectedInput = fixedTime + '53848' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, MOCK_USERS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      subscriptionId: '53848',
      contextKey: 'lb.subUsers',
    });

    await execute(params);

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores users response in context', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, MOCK_USERS);

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      contextKey: 'lb.subUsers',
    });

    await execute(params);

    expect(contextStore['lb.subUsers'].Users).toHaveLength(1);
  });

  test('handles API error', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      subscriptionId: '53848',
      contextKey: 'lb.subUsers',
    });

    await execute(params);

    expect(contextStore['lb.subUsers'].error).toBeDefined();
  });
});
