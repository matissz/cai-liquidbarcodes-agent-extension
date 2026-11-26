import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { getDeviceLimitNode } from '../../nodes/getDeviceLimit';
import { RESULT_CHILD_TYPES } from '../../nodes/resultBranches';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(getDeviceLimitNode);
const children = [
  { id: 'success-child', type: RESULT_CHILD_TYPES.success, config: {} },
  { id: 'error-child', type: RESULT_CHILD_TYPES.error, config: {} },
];
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('getDeviceLimit node (GET /v1/user/devices/limit)', () => {
  test('sends an authenticated GET with a timestamp-only signature', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user/devices/limit`).reply(200, { limitReached: true });

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'device-token',
      contextKey: 'lb.deviceLimit',
    });

    await execute(params);

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].headers!['Authorization']).toBe('Bearer device-token');
    const expectedSignature = crypto.createHash('sha256')
      .update(fixedTime + TEST_CONNECTION.signatureSalt, 'utf8')
      .digest('hex');
    expect(mock.history.get[0].headers!['X-Liquid-Signature']).toBe(expectedSignature);
  });

  test.each([true, false])('stores limitReached=%s and routes to On Success', async limitReached => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user/devices/limit`).reply(200, { limitReached });
    const { params, api, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      contextKey: 'lb.deviceLimit',
    }, children);

    await execute(params);

    expect(contextStore['lb.deviceLimit']).toEqual({ success: true, data: { limitReached } });
    expect(api.setNextNode).toHaveBeenCalledWith('success-child');
  });

  test('stores normalized scope errors and routes to On Error', async () => {
    mock.onGet(`${TEST_CONNECTION.baseUrl}/v1/user/devices/limit`).reply(403, {
      detail: 'Scope missing.',
      code: 'InsufficientScope',
      errorCode: 1005,
      traceId: 'trace-device-limit',
    });
    const { params, api, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      contextKey: 'lb.deviceLimit',
    }, children);

    await execute(params);

    expect(contextStore['lb.deviceLimit'].error).toMatchObject({
      code: 'InsufficientScope',
      errorCode: 1005,
      traceId: 'trace-device-limit',
    });
    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      operation: 'getDeviceLimit',
      operationClass: 'protectedRead',
      outcome: 'insufficientScope',
      directive: 'doNotRetry',
    });
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });
});
