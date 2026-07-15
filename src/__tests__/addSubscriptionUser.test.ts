import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { addSubscriptionUserNode } from '../nodes/addSubscriptionUser';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(addSubscriptionUserNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('addSubscriptionUser node (POST /v1/subscriptions/{id}/users)', () => {
  test('calls POST /v1/subscriptions/{id}/users with the id in the path', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      personalIdentifier: '34111111111',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`);
  });

  test('sends personalIdentifier in the body', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      personalIdentifier: '34111111111',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ personalIdentifier: '34111111111' });
  });

  test('signature = SHA256(timestamp + subscriptionId + personalIdentifier + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      personalIdentifier: '34111111111',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    const expectedInput = fixedTime + '53848' + '34111111111' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      subscriptionId: '53848',
      personalIdentifier: '34111111111',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores success result in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(200, {});

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      personalIdentifier: '34111111111',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    expect(contextStore['lb.addUser'].success).toBe(true);
  });

  test('handles API error', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/subscriptions/53848/users`).reply(400, {
      detail: 'Validation failed.',
      code: 'BOOTSTRAP_VALIDATION_FAILED',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      subscriptionId: '53848',
      personalIdentifier: '',
      contextKey: 'lb.addUser',
    });

    await execute(params);

    expect(contextStore['lb.addUser'].error).toBeDefined();
  });
});
