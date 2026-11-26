import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { clearUserDevicesNode } from '../../nodes/clearUserDevices';
import { RESULT_CHILD_TYPES } from '../../nodes/resultBranches';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from '../helpers';

const execute = getNodeFunction(clearUserDevicesNode);
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

describe('clearUserDevices node (POST /v1/user/devices/clear)', () => {
  test('sends a trimmed transaction ID with bearer authentication and a timestamp-only signature', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/user/devices/clear`).reply(200, 'Cleared');
    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'device-token',
      transactionId: '  txn-device-clear  ',
      contextKey: 'lb.clearDevices',
    });

    await execute(params);

    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ transactionId: 'txn-device-clear' });
    expect(mock.history.post[0].headers!['Authorization']).toBe('Bearer device-token');
    const expectedSignature = crypto.createHash('sha256')
      .update(fixedTime + TEST_CONNECTION.signatureSalt, 'utf8')
      .digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSignature);
  });

  test.each(['Cleared', 'NothingToClear'])('stores %s and routes to On Success', async result => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/user/devices/clear`).reply(200, result);
    const { params, api, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      transactionId: 'txn-device-clear',
      contextKey: 'lb.clearDevices',
    }, children);

    await execute(params);

    expect(contextStore['lb.clearDevices']).toEqual({ success: true, data: result });
    expect(api.setNextNode).toHaveBeenCalledWith('success-child');
  });

  test.each(['', ' ', 'x'.repeat(129)])('rejects invalid transaction ID %# before calling the API', async transactionId => {
    const { params, api, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      transactionId,
      contextKey: 'lb.clearDevices',
    }, children);

    await execute(params);

    expect(mock.history.post).toHaveLength(0);
    expect(contextStore['lb.clearDevices'].error.message).toContain('Transaction ID is required');
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });

  test.each([
    ['DeviceClearLimitReached', 140, 'conflict'],
    ['DuplicateIdempotencyKey', 1007, 'duplicateIdempotencyKey'],
    ['RequestRejected', 1000, 'requestRejected'],
  ])('stores %s as a protected-write error and routes to On Error', async (code, errorCode, outcome) => {
    mock.onPost(`${TEST_CONNECTION.baseUrl}/v1/user/devices/clear`).reply(409, {
      detail: 'Clear rejected.',
      code,
      errorCode,
      traceId: `trace-${errorCode}`,
    });
    const { params, api, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      transactionId: 'txn-device-clear',
      contextKey: 'lb.clearDevices',
    }, children);

    await execute(params);

    expect(contextStore['lb.clearDevices'].error).toMatchObject({ code, errorCode });
    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      operation: 'clearUserDevices',
      operationClass: 'protectedWrite',
      outcome,
      directive: 'doNotRetry',
    });
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });
});
