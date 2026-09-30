import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { makeAgentApiRequest } from '../../utils/httpClient';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
});

const BASE_URL = 'https://agent.api.test.l-b.dev';

describe('makeAgentApiRequest', () => {
  test('sends X-Customer-Api-Key header', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, { AccessToken: 'tok' });

    await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'my-api-key',
      signatureSalt: 'my-salt',
      signatureFields: ['token'],
      body: { ssoToken: 'token' },
    });

    expect(mock.history.post[0].headers!['X-Customer-Api-Key']).toBe('my-api-key');
  });

  test('sends X-Liquid-Timestamp as ISO 8601', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, {});

    await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
    });

    expect(mock.history.post[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('sends X-Liquid-Signature as 64-char lowercase hex', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, {});

    await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
    });

    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  test('adds Authorization Bearer header when accessToken is provided', async () => {
    mock.onGet(`${BASE_URL}/v1/user`).reply(200, {});

    await makeAgentApiRequest({
      method: 'GET',
      baseUrl: BASE_URL,
      path: '/v1/user',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
      accessToken: 'my-bearer-token',
    });

    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer my-bearer-token');
  });

  test('does NOT send Authorization header when accessToken is omitted', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, {});

    await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
    });

    expect(mock.history.post[0].headers!['Authorization']).toBeUndefined();
  });

  test('sets Content-Type for POST requests', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, {});

    await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
      body: { ssoToken: 'test' },
    });

    expect(mock.history.post[0].headers!['Content-Type']).toBe('application/json');
  });

  test('appends query params for GET requests', async () => {
    mock.onGet(new RegExp(`${BASE_URL}/v1/stores`)).reply(200, { Stores: [] });

    await makeAgentApiRequest({
      method: 'GET',
      baseUrl: BASE_URL,
      path: '/v1/stores',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
      accessToken: 'tok',
      queryParams: { storeId: '123' },
    });

    expect(mock.history.get[0].params).toEqual({ storeId: '123' });
  });

  test('returns data and status', async () => {
    const responseData = { AccessToken: 'tok', ExpiresInSeconds: 3600 };
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, responseData);

    const result = await makeAgentApiRequest({
      method: 'POST',
      baseUrl: BASE_URL,
      path: '/v1/auth/sso',
      apiKey: 'key',
      signatureSalt: 'salt',
      signatureFields: [],
      body: { ssoToken: 'test' },
    });

    expect(result.data).toEqual(responseData);
    expect(result.status).toBe(200);
  });

  test('throws on error response', async () => {
    mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(401, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
      title: 'Authentication failed.',
      status: 401,
      detail: 'The request signature is invalid.',
      instance: '/v1/auth/sso',
      code: 'INVALID_SIGNATURE',
      traceId: '00-abc-123-00',
    });

    await expect(
      makeAgentApiRequest({
        method: 'POST',
        baseUrl: BASE_URL,
        path: '/v1/auth/sso',
        apiKey: 'key',
        signatureSalt: 'salt',
        signatureFields: [],
        body: { ssoToken: 'bad' },
      })
    ).rejects.toThrow();
  });

  test('logs failure diagnostics without exposing credentials', async () => {
    const logs: string[] = [];
    mock.onPost(`${BASE_URL}/v1/auth/otp/start`).reply(401, {
      status: 401,
      detail: 'The request could not be authenticated.',
      code: 'AuthenticationFailed',
      traceId: '00-test-trace-01',
    });

    await expect(makeAgentApiRequest({
      method: 'POST',
      baseUrl: `${BASE_URL}/`,
      path: '/v1/auth/otp/start',
      apiKey: 'secret-api-key',
      signatureSalt: 'secret-signature-salt',
      signatureFields: ['34111111111'],
      body: { phone: '34111111111' },
      log: (_level, message) => logs.push(message),
    })).rejects.toThrow();

    const output = logs.join('\n');
    expect(output).toContain('AuthenticationFailed');
    expect(output).toContain('00-test-trace-01');
    expect(output).not.toContain('secret-api-key');
    expect(output).not.toContain('secret-signature-salt');
    expect(output).not.toContain('34111111111');
  });
});
