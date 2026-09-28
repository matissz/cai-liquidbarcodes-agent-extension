import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { requestSsoTokenNode } from '../nodes/requestSsoToken';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(requestSsoTokenNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('requestSsoToken node (POST /auth/lb/tokens)', () => {
  test('calls POST {appBaseUrl}/auth/lb/tokens with UserId body', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'sso-token-abc',
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.UserId).toBe('user-123');
  });

  test('signature = SHA256(timestamp + userId + appSecretKey)', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'tok',
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-456',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    const expectedInput = fixedTime + 'user-456' + TEST_CONNECTION.appSecretKey;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('stores token and expirationDate in context', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'sso-tok-xyz',
      ExpirationDate: '2026-02-15T10:00:00Z',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-789',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(contextStore['lb.ssoToken']).toEqual({
      token: 'sso-tok-xyz',
      expirationDate: '2026-02-15T10:00:00Z',
    });
  });

  test('stores camelCase token and expirationDate in context', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      token: 'camel-sso-token',
      expirationDate: '2026-02-15T10:00:00Z',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-789',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(contextStore['lb.ssoToken']).toEqual({
      token: 'camel-sso-token',
      expirationDate: '2026-02-15T10:00:00Z',
    });
  });

  test('does NOT send X-Customer-Api-Key header', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'tok',
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['X-Customer-Api-Key']).toBeUndefined();
  });

  test('does NOT send Authorization header', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'tok',
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBeUndefined();
  });

  test('sends X-Liquid-Timestamp and X-Liquid-Signature headers', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: 'tok',
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(mock.history.post[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('logs sanitized App API request lifecycle events', async () => {
    const appSecretKey = 'secret-that-must-not-be-logged';
    const userId = 'user-that-must-not-be-logged';
    const token = 'token-that-must-not-be-logged';
    const connection = { ...TEST_CONNECTION, appSecretKey };

    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(200, {
      Token: token,
      ExpirationDate: '2026-01-27T15:25:36Z',
    });

    const { params, logs } = createMockParams({
      connection,
      userId,
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    const serializedLogs = JSON.stringify(logs);
    expect(serializedLogs).toContain('lb.appRequest.prepared');
    expect(serializedLogs).toContain('lb.appRequest.sending');
    expect(serializedLogs).toContain('lb.appResponse.received');
    expect(serializedLogs).not.toContain(appSecretKey);
    expect(serializedLogs).not.toContain(userId);
    expect(serializedLogs).not.toContain(token);
    expect(serializedLogs).not.toContain(mock.history.post[0].headers!['X-Liquid-Signature'] as string);
  });

  test('handles App API error (ResponseStatus format)', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(400, {
      ResponseStatus: {
        ErrorCode: 'InvalidUserId',
        Message: 'The UserId is not valid.',
      },
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'bad-user',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(contextStore['lb.ssoToken'].error).toBeDefined();
    expect(contextStore['lb.ssoToken'].error.message).toBe('The UserId is not valid.');
    expect(contextStore['lb.ssoToken'].error.code).toBe('InvalidUserId');
  });

  test('handles network error', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).networkError();

    const { params, contextStore, logs } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(contextStore['lb.ssoToken'].error).toBeDefined();
    expect(logs.some(l => l.level === 'error')).toBe(true);
  });

  test('logs error on failure', async () => {
    mock.onPost(`${TEST_CONNECTION.appBaseUrl}/auth/lb/tokens`).reply(500, {
      ResponseStatus: {
        ErrorCode: 'InternalError',
        Message: 'Server error.',
      },
    });

    const { params, logs } = createMockParams({
      connection: TEST_CONNECTION,
      userId: 'user-123',
      contextKey: 'lb.ssoToken',
    });

    await execute(params);

    expect(logs.some(l => l.level === 'error')).toBe(true);
  });
});
