import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getUserNode } from '../nodes/getUser';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(getUserNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const MOCK_USER = {
  UserId: 'ASTMXF80843FF14664040A349B0D066C790D6',
  Msn: '1987654321',
  Name: 'Luke',
  Surname: 'Skywalker',
  Consents: [],
  Subscriptions: [],
  AgeVerifiedBy: [],
  UserMyPage: 'https://mypage.example.com',
  RegistrationDate: '2022-01-26T13:31:37.0000000+00:00',
};

describe('getUser node (GET /v1/user)', () => {
  test('calls GET /v1/user', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, MOCK_USER);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bearer-tok',
      contextKey: 'lb.user',
    });

    await execute(params);

    expect(mock.history.get.length).toBe(1);
    expect(mock.history.get[0].url).toBe(`${TEST_CONNECTION.baseUrl}/v1/user`);
  });

  test('signature = SHA256(timestamp + salt) with no extra fields', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, MOCK_USER);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bearer-tok',
      contextKey: 'lb.user',
    });

    await execute(params);

    const expectedInput = fixedTime + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, MOCK_USER);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-token',
      contextKey: 'lb.user',
    });

    await execute(params);

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-token');
  });

  test('stores full user model in context', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, MOCK_USER);

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      contextKey: 'lb.user',
    });

    await execute(params);

    expect(contextStore['lb.user'].UserId).toBe(MOCK_USER.UserId);
    expect(contextStore['lb.user'].Msn).toBe(MOCK_USER.Msn);
  });

  test('handles API error', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad-tok',
      contextKey: 'lb.user',
    });

    await execute(params);

    expect(contextStore['lb.user'].error).toBeDefined();
  });
});
