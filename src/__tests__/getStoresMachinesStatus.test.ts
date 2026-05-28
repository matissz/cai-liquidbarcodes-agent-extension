import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getStoresMachinesStatusNode } from '../nodes/getStoresMachinesStatus';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(getStoresMachinesStatusNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const MOCK_STATUS = {
  StoreMachinesStatus: [
    {
      StoreId: 22632,
      Status: 'Available',
      StoreMachines: [
        { StoreMachineId: 46, Name: 'Machine 1', Status: 'Available' },
      ],
    },
  ],
};

describe('getStoresMachinesStatus node (GET /v1/stores/machines/status)', () => {
  test('calls GET /v1/stores/machines/status', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      lastUpdateTime: '',
      contextKey: 'lb.machines',
    });

    await execute(params);

    expect(mock.history.get.length).toBe(1);
  });

  test('passes lastUpdateTime as query param when provided', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      lastUpdateTime: '2024-01-01T00:00:00Z',
      contextKey: 'lb.machines',
    });

    await execute(params);

    expect(mock.history.get[0].params).toEqual({ lastUpdateTime: '2024-01-01T00:00:00Z' });
  });

  test('signature includes lastUpdateTime when provided', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      lastUpdateTime: '2024-06-01T12:00:00Z',
      contextKey: 'lb.machines',
    });

    await execute(params);

    const expectedInput = fixedTime + '2024-06-01T12:00:00Z' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('signature excludes lastUpdateTime when empty', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      lastUpdateTime: '',
      contextKey: 'lb.machines',
    });

    await execute(params);

    const expectedInput = fixedTime + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      lastUpdateTime: '',
      contextKey: 'lb.machines',
    });

    await execute(params);

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores machine status response in context', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(200, MOCK_STATUS);

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      lastUpdateTime: '',
      contextKey: 'lb.machines',
    });

    await execute(params);

    expect(contextStore['lb.machines'].StoreMachinesStatus).toHaveLength(1);
  });

  test('handles API error', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores/machines/status`)).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      lastUpdateTime: '',
      contextKey: 'lb.machines',
    });

    await execute(params);

    expect(contextStore['lb.machines'].error).toBeDefined();
  });
});
