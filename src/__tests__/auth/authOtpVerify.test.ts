import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { authOtpVerifyNode } from '../../nodes/authOtpVerify';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

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

  test('trims phone and code consistently in body and signature', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      accessToken: 'tok',
      expiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '  34111111111  ',
      code: '  3565  ',
      contextKey: 'lb.session',
    });

    await execute(params);

    const body = JSON.parse(mock.history.post[0].data);
    const expectedInput = fixedTime + '34111111111' + '3565' + TEST_CONNECTION.signatureSalt;
    const expectedSignature = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(body).toEqual({ phone: '34111111111', code: '3565' });
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSignature);
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

  test('stores camelCase sandbox token response in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, {
      accessToken: 'tok-camel-case',
      expiresInSeconds: 1800,
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      code: '3565',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session']).toEqual({
      accessToken: 'tok-camel-case',
      expiresInSeconds: 1800,
    });
  });

  test.each([
    [{ expiresInSeconds: 3600 }],
    [{ accessToken: 'tok', expiresInSeconds: 0 }],
    [{ accessToken: '   ', expiresInSeconds: 3600 }],
  ])('stores an error for malformed successful session response %#', async responseBody => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(200, responseBody);
    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '34111111111',
      code: '3565',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session']).toEqual({
      error: { message: 'Liquid Barcodes returned an invalid OTP session response.' },
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

  test('preserves uniform AuthenticationFailed error details', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/otp/verify`).reply(401, {
      detail: 'Authentication failed.',
      code: 'AuthenticationFailed',
      errorCode: 1002,
      status: 401,
      traceId: 'trace-auth-failed',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      phone: '123',
      code: '0000',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session'].error).toEqual({
      message: 'Authentication failed.',
      code: 'AuthenticationFailed',
      errorCode: 1002,
      status: 401,
      traceId: 'trace-auth-failed',
    });
  });
});
