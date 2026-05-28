import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { authSsoNode } from '../nodes/authSso';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(authSsoNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('authSso node (POST /v1/auth/sso)', () => {
  test('calls POST /v1/auth/sso with ssoToken body', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(200, {
      AccessToken: 'tok-123',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'Testtoken123',
      contextKey: 'lb.session',
    });

    await execute(params);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.ssoToken).toBe('Testtoken123');
  });

  test('signature = SHA256(timestamp + ssoToken + salt)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(200, {
      AccessToken: 'tok',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'Testtoken123',
      contextKey: 'lb.session',
    });

    await execute(params);

    const expectedInput = fixedTime + 'Testtoken123' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('stores accessToken and expiresInSeconds in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(200, {
      AccessToken: 'tok-abc',
      ExpiresInSeconds: 7200,
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'token1',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session']).toEqual({
      accessToken: 'tok-abc',
      expiresInSeconds: 7200,
    });
  });

  test('sends X-Customer-Api-Key header', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(200, {
      AccessToken: 'tok',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'token1',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['X-Customer-Api-Key']).toBe(TEST_CONNECTION.apiKey);
  });

  test('does NOT send Authorization header', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(200, {
      AccessToken: 'tok',
      ExpiresInSeconds: 3600,
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'token1',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBeUndefined();
  });

  test('handles API error and stores error in context', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(401, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
      title: 'Authentication failed.',
      status: 401,
      detail: 'The request signature is invalid.',
      instance: '/v1/auth/sso',
      code: 'INVALID_SIGNATURE',
      traceId: '00-abc-00',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'bad-token',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(contextStore['lb.session'].error).toBeDefined();
    expect(contextStore['lb.session'].error.code).toBe('INVALID_SIGNATURE');
  });

  test('logs error on failure', async () => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/auth/sso`).reply(400, {
      detail: 'Validation failed.',
      code: 'BOOTSTRAP_VALIDATION_FAILED',
    });

    const { params, logs } = createMockParams({
      connection: TEST_CONNECTION,
      ssoToken: 'bad',
      contextKey: 'lb.session',
    });

    await execute(params);

    expect(logs.some(l => l.level === 'error')).toBe(true);
  });
});
