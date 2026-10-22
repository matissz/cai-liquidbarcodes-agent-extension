import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getUserNode } from '../../nodes/getUser';
import { createMockParams as createBaseMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

function createMockParams(config: Record<string, any>, childConfigs: any[] = []) {
  return createBaseMockParams({ allowedPlanIds: '[42]', ...config }, childConfigs);
}

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

  test.each([
    ['SessionInvalid', 1004, 401],
    ['InsufficientScope', 1005, 403],
  ])('preserves %s protected-session error', async (code, errorCode, status) => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(status, {
      detail: 'Protected request failed.',
      code,
      errorCode,
      status,
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad-tok',
      contextKey: 'lb.user',
    });

    await execute(params);

    expect(contextStore['lb.user'].error).toEqual({
      message: 'Protected request failed.',
      detail: 'Protected request failed.',
      code,
      errorCode,
      status,
    });
  });

  test.each([
    ['Owner', 'subscriptions'],
    ['Child', 'sharedSubscriptions'],
  ])('preserves %s relationship metadata unchanged', async (role, collection) => {
    const subscription = {
      role,
      subscriptionId: role === 'Owner' ? 53848 : 53849,
      planId: 42,
      planName: 'Car Wash',
      subscriptionState: 'Active',
      renewalDate: '2026-11-01T00:00:00Z',
    };
    const payload = { ...MOCK_USER, role, subscriptions: [], sharedSubscriptions: [], [collection]: [subscription] };
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, payload);
    const { params, contextStore } = createMockParams({ connection: TEST_CONNECTION, accessToken: 'tok', contextKey: 'lb.user' });

    await execute(params);

    expect(contextStore['lb.user']).toEqual({
      ...payload,
      cancellationSelection: role === 'Owner'
        ? { outcome: 'selected', selected: subscription, candidates: [subscription] }
        : { outcome: 'notOwner', candidates: [subscription] },
    });
    expect(contextStore['lb.user'][collection][0]).toEqual(subscription);
  });

  test('adds a noMatch selection without changing provider fields', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, MOCK_USER);
    const { params, contextStore } = createMockParams({ connection: TEST_CONNECTION, accessToken: 'tok', contextKey: 'lb.user' });

    await execute(params);

    expect(contextStore['lb.user']).toEqual({
      ...MOCK_USER,
      cancellationSelection: { outcome: 'noMatch', candidates: [] },
    });
  });

  test.each(['', 'not-json', '[]', '[0]', '["42"]'])('rejects invalid plan configuration before calling the API: %s', async allowedPlanIds => {
    const children = [{ id: 'error-child', type: 'liquidBarcodesOnError', config: {} }];
    const { params, contextStore, api } = createMockParams({
      connection: TEST_CONNECTION, accessToken: 'tok', allowedPlanIds, contextKey: 'lb.user',
    }, children);

    await execute(params);

    expect(mock.history.get).toHaveLength(0);
    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      operation: 'getUser', outcome: 'invalidInput', directive: 'doNotRetry',
    });
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });

  test('routes malformed matching subscription data to On Error', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(200, {
      subscriptions: [{ planId: 42, role: 'Owner', subscriptionState: 'Active' }],
    });
    const children = [{ id: 'error-child', type: 'liquidBarcodesOnError', config: {} }];
    const { params, contextStore, api } = createMockParams({ connection: TEST_CONNECTION, accessToken: 'tok', contextKey: 'lb.user' }, children);

    await execute(params);

    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({ outcome: 'invalidInput' });
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });

  test('routes a scope failure to On Error and stores its classified outcome', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user`).reply(403, {
      detail: 'Protected request failed.',
      code: 'InsufficientScope',
      errorCode: 1005,
      status: 403,
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad-tok',
      contextKey: 'lb.user',
    });
    params.childConfigs = [{
      id: 'error-child',
      type: 'liquidBarcodesOnError',
      config: {},
    }];

    await execute(params);

    expect(params.cognigy.api.setNextNode).toHaveBeenCalledWith('error-child');
    expect(contextStore['liquidBarcodesAgent.errorHandling.current'].outcome).toBe('insufficientScope');
  });
});
