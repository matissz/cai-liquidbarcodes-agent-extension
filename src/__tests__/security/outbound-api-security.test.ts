import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { makeAgentApiRequest } from '../../utils/httpClient';

const BASE_URL = 'https://agent.api.test.l-b.dev';
const API_KEY = 'security-suite-api-key';
const SIGNATURE_SALT = 'security-suite-signature-salt';
const ACCESS_TOKEN = 'security-suite-access-token';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
});

describe('Dedicated outbound API security suite', () => {
  describe('OWASP API2:2023 - Broken Authentication', () => {
    test('does not invent an Authorization header for unauthenticated endpoints', async () => {
      mock.onPost(`${BASE_URL}/v1/auth/sso`).reply(200, {});

      await makeAgentApiRequest({
        method: 'POST',
        baseUrl: BASE_URL,
        path: '/v1/auth/sso',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: ['sso-token'],
        body: { ssoToken: 'sso-token' },
      });

      expect(mock.history.post[0].headers?.Authorization).toBeUndefined();
    });

    test('places the access token only in the Bearer authorization header', async () => {
      mock.onGet(`${BASE_URL}/v1/user`).reply(200, {});

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/user',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        accessToken: ACCESS_TOKEN,
      });

      const request = mock.history.get[0];
      expect(request.headers?.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
      expect(request.url).not.toContain(ACCESS_TOKEN);
      expect(request.params).toBeUndefined();
      expect(request.data).toBeUndefined();
    });

    test('omits a whitespace-only access token', async () => {
      mock.onGet(`${BASE_URL}/v1/user`).reply(200, {});

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/user',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        accessToken: '   ',
      });

      expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
    });
  });

  describe('OWASP API8:2023 - Security Misconfiguration', () => {
    test('sends the API key and signature in their designated headers only', async () => {
      mock.onGet(`${BASE_URL}/v1/user`).reply(200, {});

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: `${BASE_URL}/`,
        path: '/v1/user',
        apiKey: `  ${API_KEY}  `,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        accessToken: ACCESS_TOKEN,
      });

      const request = mock.history.get[0];
      expect(request.headers?.['X-Customer-Api-Key']).toBe(API_KEY);
      expect(request.headers?.['X-Liquid-Signature']).toMatch(/^[a-f0-9]{64}$/);
      expect(request.url).toBe(`${BASE_URL}/v1/user`);
      expect(request.url).not.toContain(API_KEY);
      expect(request.url).not.toContain(SIGNATURE_SALT);
      expect(JSON.stringify(request.params ?? {})).not.toContain(API_KEY);
      expect(JSON.stringify(request.data ?? {})).not.toContain(SIGNATURE_SALT);
    });

    test('does not send a request body or content type on GET', async () => {
      mock.onGet(`${BASE_URL}/v1/stores`).reply(200, { Stores: [] });

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/stores',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        body: { unexpected: 'body' },
      });

      const request = mock.history.get[0];
      expect(request.data).toBeUndefined();
      expect(request.headers?.['Content-Type']).toBeUndefined();
    });
  });

  describe('OWASP API10:2023 - Unsafe Consumption of APIs', () => {
    test.each([
      "' OR '1'='1",
      '<script>alert(1)</script>',
      '../../admin',
      'value\r\nX-Injected-Header: true',
    ])('keeps untrusted query input in structured params: %s', async payload => {
      mock.onGet(`${BASE_URL}/v1/stores`).reply(200, { Stores: [] });

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/stores',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [payload],
        queryParams: { storeId: payload },
      });

      const request = mock.history.get[0];
      expect(request.url).toBe(`${BASE_URL}/v1/stores`);
      expect(request.params).toEqual({ storeId: payload });
      expect(request.headers?.['X-Injected-Header']).toBeUndefined();
    });

    test('does not expose request credentials in success logs', async () => {
      const logs: string[] = [];
      mock.onGet(`${BASE_URL}/v1/user`).reply(200, { UserId: 'user-1' });

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/user',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        accessToken: ACCESS_TOKEN,
        log: (_level, message) => logs.push(message),
      });

      const output = logs.join('\n');
      expect(output).not.toContain(API_KEY);
      expect(output).not.toContain(SIGNATURE_SALT);
      expect(output).not.toContain(ACCESS_TOKEN);
    });

    test('does not repeat credentials echoed by an upstream error in logs', async () => {
      const logs: string[] = [];
      mock.onGet(`${BASE_URL}/v1/user`).reply(502, {
        code: 'UPSTREAM_ERROR',
        detail: `Rejected ${API_KEY} ${SIGNATURE_SALT} ${ACCESS_TOKEN}`,
      });

      await expect(makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/user',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
        accessToken: ACCESS_TOKEN,
        log: (_level, message) => logs.push(message),
      })).rejects.toThrow();

      const output = logs.join('\n');
      expect(output).not.toContain(API_KEY);
      expect(output).not.toContain(SIGNATURE_SALT);
      expect(output).not.toContain(ACCESS_TOKEN);
    });

    test('redacts OTP and SSO signature fields echoed by an upstream error', async () => {
      const logs: string[] = [];
      const phone = '34111111111';
      const otpCode = '3565';
      const ssoToken = 'single-use-sso-token';
      mock.onPost(`${BASE_URL}/v1/auth/otp/verify`).reply(401, {
        code: 'AuthenticationFailed',
        errorCode: 1002,
        detail: `Rejected ${phone} ${otpCode} ${ssoToken}`,
      });

      await expect(makeAgentApiRequest({
        method: 'POST',
        baseUrl: BASE_URL,
        path: '/v1/auth/otp/verify',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [phone, otpCode, ssoToken],
        body: { phone, code: otpCode },
        log: (_level, message) => logs.push(message),
      })).rejects.toThrow();

      const output = logs.join('\n');
      expect(output).not.toContain(phone);
      expect(output).not.toContain(otpCode);
      expect(output).not.toContain(ssoToken);
      expect(output).toContain('[REDACTED]');
    });
  });

  describe('OWASP API4:2023 - Unrestricted Resource Consumption', () => {
    test('sets a finite timeout on every outbound request', async () => {
      mock.onGet(`${BASE_URL}/v1/user`).reply(200, {});

      await makeAgentApiRequest({
        method: 'GET',
        baseUrl: BASE_URL,
        path: '/v1/user',
        apiKey: API_KEY,
        signatureSalt: SIGNATURE_SALT,
        signatureFields: [],
      });

      expect(mock.history.get[0].timeout).toEqual(expect.any(Number));
      expect(mock.history.get[0].timeout).toBeGreaterThan(0);
    });
  });
});