import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getAuditEventsNode } from '../../nodes/getAuditEvents';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(getAuditEventsNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

function config(overrides: Record<string, unknown> = {}) {
  return {
    connection: TEST_CONNECTION,
    userId: '12345',
    phone: '',
    limit: '100',
    contextKey: 'lb.audit',
    ...overrides,
  };
}

describe('getAuditEvents node (GET /v1/audit-events)', () => {
  test('sends signed user query without Authorization and stores response', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);
    const events = [{ occurredAt: fixedTime, method: 'GET', path: '/v1/user', statusCode: 200, userId: '12345' }];
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/audit-events`)).reply(200, events);
    const { params, contextStore } = createMockParams(config());

    await execute(params);

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].params).toEqual({ userId: '12345', limit: '100' });
    expect(mock.history.get[0].headers!['Authorization']).toBeUndefined();
    const expected = crypto.createHash('sha256')
      .update(fixedTime + '12345' + '' + '100' + TEST_CONNECTION.signatureSalt, 'utf8')
      .digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expected);
    expect(contextStore['lb.audit']).toEqual(events);
  });

  test('supports phone lookup and defaults an empty limit to 100', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/audit-events`)).reply(200, []);
    const { params } = createMockParams(config({ userId: '', phone: '4791234567', limit: '' }));

    await execute(params);

    expect(mock.history.get[0].params).toEqual({ phone: '4791234567', limit: '100' });
  });

  test.each([
    [{ userId: '', phone: '' }, 'exactly one'],
    [{ userId: '123', phone: '4791234567' }, 'exactly one'],
    [{ userId: 'abc', phone: '' }, 'digits only'],
    [{ userId: '', phone: '123' }, '7-13 digits'],
    [{ limit: '0' }, '1 to 500'],
    [{ limit: '501' }, '1 to 500'],
  ])('rejects invalid configuration %# before calling the API', async (overrides, message) => {
    const { params, contextStore } = createMockParams(config(overrides));

    await execute(params);

    expect(mock.history.get).toHaveLength(0);
    expect(contextStore['lb.audit'].error.message).toContain(message);
  });

  test('stores an API error', async () => {
    mock.onGet(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/audit-events`)).reply(400, {
      code: 'InvalidInput', errorCode: 1001, detail: 'Invalid query.',
    });
    const { params, contextStore } = createMockParams(config());

    await execute(params);

    expect(contextStore['lb.audit'].error.code).toBe('InvalidInput');
  });
});
