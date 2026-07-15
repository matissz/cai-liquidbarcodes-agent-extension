import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { setPlateNumberNode } from '../nodes/setPlateNumber';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(setPlateNumberNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('setPlateNumber node (PUT /v1/user/plate-number)', () => {
  test('calls PUT /v1/user/plate-number', async () => {
    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    expect(mock.history.put.length).toBe(1);
  });

  test('sends plateNumber in the body', async () => {
    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    expect(JSON.parse(mock.history.put[0].data)).toEqual({ plateNumber: 'ABC123' });
  });

  test('signature = SHA256(timestamp + plateNumber + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    const expectedInput = fixedTime + 'ABC123' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.put[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    expect(mock.history.put[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores success result in context', async () => {
    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(200, {});

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    expect(contextStore['lb.plate'].success).toBe(true);
  });

  test('handles API error', async () => {
    mock.onPut(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/user/plate-number`)).reply(401, {
      detail: 'Authentication failed.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'bad',
      plateNumber: 'ABC123',
      contextKey: 'lb.plate',
    });

    await execute(params);

    expect(contextStore['lb.plate'].error).toBeDefined();
  });
});
