import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { authOtpStartNode } from '../nodes/authOtpStart';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(authOtpStartNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('authOtpStart node (POST /v1/auth/otp/start)', () => {
  test('calls POST /v1/auth/otp/start with phone body', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(200, {
      Phone: '34111111111',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      contextKey: 'lb.otp',
    });

    await execute(params);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.phone).toBe('34111111111');
  });

  test('signature = SHA256(timestamp + phone + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(200, {
      Phone: '34111111111',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      contextKey: 'lb.otp',
    });

    await execute(params);

    const expectedInput = fixedTime + '34111111111' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('stores phone response in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(200, {
      Phone: '34111111111',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      contextKey: 'lb.otp',
    });

    await execute(params);

    expect(contextStore['lb.otp']).toEqual({ phone: '34111111111' });
  });

  test('stores camelCase sandbox phone response in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(200, {
      phone: '34111111111',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      contextKey: 'lb.otp',
    });

    await execute(params);

    expect(contextStore['lb.otp']).toEqual({ phone: '34111111111' });
  });

  test('does NOT send Authorization header', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(200, { Phone: '123' });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '123',
      contextKey: 'lb.otp',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBeUndefined();
  });

  test('handles API error', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/start`).reply(400, {
      detail: 'Validation failed.',
      code: 'BOOTSTRAP_VALIDATION_FAILED',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: 'bad',
      contextKey: 'lb.otp',
    });

    await execute(params);

    expect(contextStore['lb.otp'].error).toBeDefined();
  });
});
