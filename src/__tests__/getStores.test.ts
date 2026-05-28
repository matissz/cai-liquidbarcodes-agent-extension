import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getStoresNode } from '../nodes/getStores';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(getStoresNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const MOCK_STORES = {
  Stores: [
    { Id: 22632, ExternalId: 1, Name: 'Store A', CurrentState: 'Open' },
    { Id: 22634, ExternalId: 2, Name: 'Store B', CurrentState: 'Closed' },
  ],
};

describe('getStores node (GET /v1/stores)', () => {
  test('calls GET /v1/stores without storeId', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, MOCK_STORES);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      contextKey: 'lb.stores',
    });

    await execute(params);

    expect(mock.history.get.length).toBe(1);
  });

  test('passes storeId as query param when provided', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, { Stores: [MOCK_STORES.Stores[0]] });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '22632',
      contextKey: 'lb.stores',
    });

    await execute(params);

    expect(mock.history.get[0].params).toEqual({ storeId: '22632' });
  });

  test('signature includes storeId when provided', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, MOCK_STORES);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '22632',
      contextKey: 'lb.stores',
    });

    await execute(params);

    const expectedInput = fixedTime + '22632' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('signature excludes storeId when empty', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, MOCK_STORES);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      contextKey: 'lb.stores',
    });

    await execute(params);

    const expectedInput = fixedTime + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, MOCK_STORES);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      storeId: '',
      contextKey: 'lb.stores',
    });

    await execute(params);

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores stores response in context', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(200, MOCK_STORES);

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      contextKey: 'lb.stores',
    });

    await execute(params);

    expect(contextStore['lb.stores'].Stores).toHaveLength(2);
  });

  test('handles API error', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/stores`)).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      storeId: '',
      contextKey: 'lb.stores',
    });

    await execute(params);

    expect(contextStore['lb.stores'].error).toBeDefined();
  });
});
