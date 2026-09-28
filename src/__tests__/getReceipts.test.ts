import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getReceiptsNode } from '../nodes/getReceipts';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(getReceiptsNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const MOCK_RECEIPTS = {
  Logo: 'https://url.to.company.logo.jpg',
  Receipts: [
    { ReceiptId: 'r-1', Format: 'Liquid/1.0', Receipt: '{"SubTotal":1.50}' },
  ],
};

describe('getReceipts node (GET /v1/receipts)', () => {
  test('calls GET /v1/receipts', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(mock.history.get.length).toBe(1);
  });

  test('passes storeId and dateFrom as query params', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '22632',
      dateFrom: '2024-01-01T00:00:00Z',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(mock.history.get[0].params).toEqual({
      storeId: '22632',
      dateFrom: '2024-01-01T00:00:00Z',
    });
  });

  test('signature = SHA256(timestamp + storeId + dateFrom + salt) with both filters', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '22632',
      dateFrom: '2024-01-01T00:00:00Z',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    const expectedInput = fixedTime + '22632' + '2024-01-01T00:00:00Z' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('signature omits absent optional fields', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    const expectedInput = fixedTime + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('signature with only dateFrom, no storeId', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      dateFrom: '2024-06-01T00:00:00Z',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    const expectedInput = fixedTime + '2024-06-01T00:00:00Z' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores receipts response in context', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, MOCK_RECEIPTS);

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(contextStore['lb.receipts'].Logo).toBe(MOCK_RECEIPTS.Logo);
    expect(contextStore['lb.receipts'].Receipts).toHaveLength(1);
  });

  test('stores camelCase response and logs the correct receipt count', async () => {
    const camelCaseResponse = {
      logo: 'https://url.to.company.logo.jpg',
      receipts: [{ receiptId: 'r-1', format: 'Liquid/1.0' }],
    };
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(200, camelCaseResponse);

    const { params, contextStore, logs } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(contextStore['lb.receipts']).toEqual(camelCaseResponse);
    expect(logs.some(log => log.message === 'Get receipts succeeded (1 receipts)')).toBe(true);
  });

  test('handles API error', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/receipts`)).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      storeId: '',
      dateFrom: '',
      contextKey: 'lb.receipts',
    });

    await execute(params);

    expect(contextStore['lb.receipts'].error).toBeDefined();
  });
});
