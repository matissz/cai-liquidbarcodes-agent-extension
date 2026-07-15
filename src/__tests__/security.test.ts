import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { requestSsoTokenNode } from '../nodes/requestSsoToken';
import { authSsoNode } from '../nodes/authSso';
import { authOtpStartNode } from '../nodes/authOtpStart';
import { authOtpVerifyNode } from '../nodes/authOtpVerify';
import { getUserNode } from '../nodes/getUser';
import { getStoresNode } from '../nodes/getStores';
import { getStoresMachinesStatusNode } from '../nodes/getStoresMachinesStatus';
import { getReceiptsNode } from '../nodes/getReceipts';
import { cancelSubscriptionNode } from '../nodes/cancelSubscription';
import { getSubscriptionUsersNode } from '../nodes/getSubscriptionUsers';
import { addSubscriptionUserNode } from '../nodes/addSubscriptionUser';
import { removeSubscriptionUserNode } from '../nodes/removeSubscriptionUser';
import { setPlateNumberNode } from '../nodes/setPlateNumber';
import { issueCouponNode } from '../nodes/issueCoupon';
import { createMockParams, getNodeFunction } from './helpers';

let mock: MockAdapter;

const BASE_URL = 'https://agent.api.test.l-b.dev';
const APP_BASE_URL = 'https://app.api.test.l-b.dev';
const API_KEY = 'SECRET-API-KEY-NEVER-EXPOSE';
const SALT = 'SECRET-SALT-NEVER-EXPOSE';
const APP_SECRET = 'SECRET-APP-KEY-NEVER-EXPOSE';

const connection = { baseUrl: BASE_URL, apiKey: API_KEY, signatureSalt: SALT, appBaseUrl: APP_BASE_URL, appSecretKey: APP_SECRET };

beforeEach(() => {
  mock = new MockAdapter(axios);
  mock.onAny(new RegExp('.*')).reply(200, {
    AccessToken: 'tok', ExpiresInSeconds: 3600, Phone: '123',
    UserId: 'u1', Msn: '123', Consents: [], Subscriptions: [], AgeVerifiedBy: [],
    UserMyPage: '', RegistrationDate: '',
    Stores: [], StoreMachinesStatus: [],
    Logo: '', Receipts: [],
    Token: 'sso-tok', ExpirationDate: '2026-01-27T15:25:36Z',
  });
});

afterEach(() => {
  mock.restore();
});

// ─── SECRET LEAK PREVENTION ──────────────────────────────────────────────────

describe('Security: signatureSalt never leaks', () => {
  const APP_API_NODES = [
    { node: requestSsoTokenNode, config: { connection, userId: 'u1', contextKey: 'k' } },
  ];

  const AUTH_NODES = [
    { node: authSsoNode, config: { connection, ssoToken: 'tok1', contextKey: 'k' } },
    { node: authOtpStartNode, config: { connection, phone: '123', contextKey: 'k' } },
    { node: authOtpVerifyNode, config: { connection, phone: '123', code: '1234', contextKey: 'k' } },
  ];

  const DATA_NODES = [
    { node: getUserNode, config: { connection, accessToken: 'at', contextKey: 'k' } },
    { node: getStoresNode, config: { connection, accessToken: 'at', storeId: '', contextKey: 'k' } },
    { node: getStoresMachinesStatusNode, config: { connection, accessToken: 'at', lastUpdateTime: '', contextKey: 'k' } },
    { node: getReceiptsNode, config: { connection, accessToken: 'at', storeId: '', dateFrom: '', contextKey: 'k' } },
  ];

  const WRITE_NODES = [
    { node: cancelSubscriptionNode, config: { connection, accessToken: 'at', subscriptionId: '1', contextKey: 'k' } },
    { node: getSubscriptionUsersNode, config: { connection, accessToken: 'at', subscriptionId: '1', contextKey: 'k' } },
    { node: addSubscriptionUserNode, config: { connection, accessToken: 'at', subscriptionId: '1', personalIdentifier: '123', contextKey: 'k' } },
    { node: removeSubscriptionUserNode, config: { connection, accessToken: 'at', subscriptionId: '1', userId: '2', contextKey: 'k' } },
    { node: setPlateNumberNode, config: { connection, accessToken: 'at', plateNumber: 'ABC123', contextKey: 'k' } },
    { node: issueCouponNode, config: { connection, accessToken: 'at', scheduleId: '1', expirationDate: '', transactionId: '', contextKey: 'k' } },
  ];

  const ALL = [...APP_API_NODES, ...AUTH_NODES, ...DATA_NODES, ...WRITE_NODES];

  test.each(ALL.map(n => [n.node.type, n]))('%s: signatureSalt not in context', async (_type, { node, config }) => {
    const execute = getNodeFunction(node);
    const { params, api } = createMockParams(config);
    await execute(params);

    for (const call of api.addToContext.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(SALT);
    }
  });

  test.each(ALL.map(n => [n.node.type, n]))('%s: signatureSalt not in logs', async (_type, { node, config }) => {
    const execute = getNodeFunction(node);
    const { params, api } = createMockParams(config);
    await execute(params);

    for (const call of api.log.mock.calls) {
      expect(call[1]).not.toContain(SALT);
    }
  });

  test.each(ALL.map(n => [n.node.type, n]))('%s: signatureSalt not in HTTP headers or body', async (_type, { node, config }) => {
    mock.resetHistory();
    const execute = getNodeFunction(node);
    const { params } = createMockParams(config);
    await execute(params);

    const history = [
      ...mock.history.post,
      ...mock.history.get,
      ...mock.history.put,
      ...mock.history.patch,
      ...mock.history.delete,
    ];
    for (const req of history) {
      expect(JSON.stringify(req.headers)).not.toContain(SALT);
      if (req.data) {
        const bodyStr = typeof req.data === 'string' ? req.data : JSON.stringify(req.data);
        expect(bodyStr).not.toContain(SALT);
      }
    }
  });
});

describe('Security: apiKey only appears in X-Customer-Api-Key header', () => {
  const nodes = [
    { node: authSsoNode, config: { connection, ssoToken: 'tok1', contextKey: 'k' } },
    { node: getUserNode, config: { connection, accessToken: 'at', contextKey: 'k' } },
  ];

  test.each(nodes.map(n => [n.node.type, n]))('%s: apiKey in header, not in context', async (_type, { node, config }) => {
    mock.resetHistory();
    const execute = getNodeFunction(node);
    const { params, api } = createMockParams(config);
    await execute(params);

    const history = [...mock.history.post, ...mock.history.get];
    expect(history[0].headers!['X-Customer-Api-Key']).toBe(API_KEY);

    for (const call of api.addToContext.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(API_KEY);
    }
  });
});

describe('Security: appSecretKey never leaks', () => {
  test('requestSsoToken: appSecretKey not in context, logs, headers, or body', async () => {
    mock.resetHistory();
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params, api } = createMockParams({
      connection,
      userId: 'u1',
      contextKey: 'k',
    });
    await execute(params);

    for (const call of api.addToContext.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(APP_SECRET);
    }
    for (const call of api.log.mock.calls) {
      expect(call[1]).not.toContain(APP_SECRET);
    }
    const history = mock.history.post;
    for (const req of history) {
      expect(JSON.stringify(req.headers)).not.toContain(APP_SECRET);
      if (req.data) {
        const bodyStr = typeof req.data === 'string' ? req.data : JSON.stringify(req.data);
        expect(bodyStr).not.toContain(APP_SECRET);
      }
    }
  });

  test('requestSsoToken: does NOT send X-Customer-Api-Key header', async () => {
    mock.resetHistory();
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params } = createMockParams({
      connection,
      userId: 'u1',
      contextKey: 'k',
    });
    await execute(params);

    const history = mock.history.post;
    expect(history[0].headers!['X-Customer-Api-Key']).toBeUndefined();
  });
});

// ─── SECRET LEAK ON ERROR ────────────────────────────────────────────────────

describe('Security: secrets do not leak on API error', () => {
  test('signatureSalt not in context or logs on error', async () => {
    mock.reset();
    mock.onPost(new RegExp('.*')).reply(500, { detail: 'Server error' });

    const execute = getNodeFunction(authSsoNode);
    const { params, api } = createMockParams({
      connection,
      ssoToken: 'tok1',
      contextKey: 'k',
    });

    await execute(params);

    for (const call of api.addToContext.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(SALT);
    }
    for (const call of api.log.mock.calls) {
      expect(call[1]).not.toContain(SALT);
    }
  });

  test('apiKey not in context or logs on network error', async () => {
    mock.reset();
    mock.onPost(new RegExp('.*')).networkError();

    const execute = getNodeFunction(authSsoNode);
    const { params, api } = createMockParams({
      connection,
      ssoToken: 'tok1',
      contextKey: 'k',
    });

    await execute(params);

    for (const call of api.addToContext.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(API_KEY);
    }
    for (const call of api.log.mock.calls) {
      expect(call[1]).not.toContain(API_KEY);
    }
  });
});

// ─── INPUT SANITIZATION ──────────────────────────────────────────────────────

describe('Security: input sanitization', () => {
  test('XSS in ssoToken does not break execution', async () => {
    const execute = getNodeFunction(authSsoNode);
    const { params } = createMockParams({
      connection,
      ssoToken: '<script>alert("xss")</script>',
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('SQL injection in phone does not break execution', async () => {
    const execute = getNodeFunction(authOtpStartNode);
    const { params } = createMockParams({
      connection,
      phone: "'; DROP TABLE users; --",
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('very long input does not cause crash', async () => {
    const execute = getNodeFunction(authSsoNode);
    const { params } = createMockParams({
      connection,
      ssoToken: 'A'.repeat(100_000),
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('null byte in code is handled', async () => {
    const execute = getNodeFunction(authOtpVerifyNode);
    const { params } = createMockParams({
      connection,
      phone: '123',
      code: 'CODE\x00INJECTED',
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('unicode/emoji in fields do not break execution', async () => {
    const execute = getNodeFunction(authSsoNode);
    const { params } = createMockParams({
      connection,
      ssoToken: '\u{1F600}é你好',
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('XSS in userId does not break requestSsoToken', async () => {
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params } = createMockParams({
      connection,
      userId: '<script>alert("xss")</script>',
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });

  test('very long userId does not cause crash', async () => {
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params } = createMockParams({
      connection,
      userId: 'U'.repeat(100_000),
      contextKey: 'k',
    });

    await expect(execute(params)).resolves.toBeUndefined();
  });
});

// ─── HEADER INTEGRITY ────────────────────────────────────────────────────────

describe('Security: header integrity', () => {
  test('requestSsoToken sends signature headers but NOT Authorization or X-Customer-Api-Key', async () => {
    mock.resetHistory();
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params } = createMockParams({
      connection,
      userId: 'u1',
      contextKey: 'k',
    });
    await execute(params);

    const history = mock.history.post;
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(history[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(history[0].headers!['X-Customer-Api-Key']).toBeUndefined();
    expect(history[0].headers!['Authorization']).toBeUndefined();
  });

  test('auth nodes send signature headers but NOT Authorization', async () => {
    const authNodes = [
      { node: authSsoNode, config: { connection, ssoToken: 'tok1', contextKey: 'k' } },
      { node: authOtpStartNode, config: { connection, phone: '123', contextKey: 'k' } },
      { node: authOtpVerifyNode, config: { connection, phone: '123', code: '1234', contextKey: 'k' } },
    ];

    for (const { node, config } of authNodes) {
      mock.resetHistory();
      const execute = getNodeFunction(node);
      const { params } = createMockParams(config);
      await execute(params);

      const history = mock.history.post;
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
      expect(history[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(history[0].headers!['X-Customer-Api-Key']).toBe(API_KEY);
      expect(history[0].headers!['Authorization']).toBeUndefined();
    }
  });

  test('data nodes send signature headers AND Authorization Bearer', async () => {
    const dataNodes = [
      { node: getUserNode, config: { connection, accessToken: 'at', contextKey: 'k' } },
      { node: getStoresNode, config: { connection, accessToken: 'at', storeId: '', contextKey: 'k' } },
      { node: getStoresMachinesStatusNode, config: { connection, accessToken: 'at', lastUpdateTime: '', contextKey: 'k' } },
      { node: getReceiptsNode, config: { connection, accessToken: 'at', storeId: '', dateFrom: '', contextKey: 'k' } },
    ];

    for (const { node, config } of dataNodes) {
      mock.resetHistory();
      const execute = getNodeFunction(node);
      const { params } = createMockParams(config);
      await execute(params);

      const history = mock.history.get;
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
      expect(history[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(history[0].headers!['X-Customer-Api-Key']).toBe(API_KEY);
      expect(history[0].headers!['Authorization']).toBe('Bearer at');
    }
  });

  test('write nodes send signature headers AND Authorization Bearer', async () => {
    const writeNodes = [
      { node: cancelSubscriptionNode, config: { connection, accessToken: 'at', subscriptionId: '1', contextKey: 'k' } },
      { node: addSubscriptionUserNode, config: { connection, accessToken: 'at', subscriptionId: '1', personalIdentifier: '123', contextKey: 'k' } },
      { node: removeSubscriptionUserNode, config: { connection, accessToken: 'at', subscriptionId: '1', userId: '2', contextKey: 'k' } },
      { node: setPlateNumberNode, config: { connection, accessToken: 'at', plateNumber: 'ABC123', contextKey: 'k' } },
      { node: issueCouponNode, config: { connection, accessToken: 'at', scheduleId: '1', expirationDate: '', transactionId: '', contextKey: 'k' } },
    ];

    for (const { node, config } of writeNodes) {
      mock.resetHistory();
      const execute = getNodeFunction(node);
      const { params } = createMockParams(config);
      await execute(params);

      const history = [...mock.history.post, ...mock.history.put, ...mock.history.patch, ...mock.history.delete];
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].headers!['X-Liquid-Signature']).toMatch(/^[0-9a-f]{64}$/);
      expect(history[0].headers!['X-Liquid-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(history[0].headers!['X-Customer-Api-Key']).toBe(API_KEY);
      expect(history[0].headers!['Authorization']).toBe('Bearer at');
    }
  });
});

// ─── URL INJECTION ───────────────────────────────────────────────────────────

describe('Security: URL injection', () => {
  test('javascript: protocol baseUrl causes axios to fail', async () => {
    mock.reset();
    const execute = getNodeFunction(authSsoNode);
    const { params, contextStore } = createMockParams({
      connection: { baseUrl: 'javascript:alert(1)', apiKey: 'k', signatureSalt: 's', appBaseUrl: 'https://app.test', appSecretKey: 's' },
      ssoToken: 'tok',
      contextKey: 'k',
    });

    await execute(params);

    expect(contextStore['k'].error).toBeDefined();
  });

  test('javascript: protocol appBaseUrl causes axios to fail', async () => {
    mock.reset();
    const execute = getNodeFunction(requestSsoTokenNode);
    const { params, contextStore } = createMockParams({
      connection: { baseUrl: 'https://test', apiKey: 'k', signatureSalt: 's', appBaseUrl: 'javascript:alert(1)', appSecretKey: 's' },
      userId: 'u1',
      contextKey: 'k',
    });

    await execute(params);

    expect(contextStore['k'].error).toBeDefined();
  });
});
