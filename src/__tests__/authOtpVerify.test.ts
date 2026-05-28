import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { authOtpVerifyNode } from '../nodes/authOtpVerify';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(authOtpVerifyNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('authOtpVerify node (POST /v1/auth/otp/verify)', () => {
  test('calls POST /v1/auth/otp/verify with phone and code', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      AccessToken: 'tok-456',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      code: '3565',
      contextKey: 'lb.session',
    });

    await execute(params);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.phone).toBe('34111111111');
    expect(body.code).toBe('3565');
  });

  test('signature = SHA256(timestamp + phone + code + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      AccessToken: 'tok',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      code: '3565',
      contextKey: 'lb.session',
    });

    await execute(params);

    const expectedInput = fixedTime + '34111111111' + '3565' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('stores accessToken and expiresInSeconds in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      AccessToken: 'tok-verified',
      ExpiresInSeconds: 1800,
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      code: '3565',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session']).toEqual({
      accessToken: 'tok-verified',
      expiresInSeconds: 1800,
    });
  });

  test('does NOT send Authorization header', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      AccessToken: 'tok',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '123',
      code: '1234',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBeUndefined();
  });

  test('handles API error', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(401, {
      detail: 'The request signature is invalid.',
      code: 'INVALID_SIGNATURE',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '123',
      code: 'wrong',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session'].error).toBeDefined();
    expect(contextStore['lb.session'].error.code).toBe('INVALID_SIGNATURE');
  });
});
