import axios from 'axios';
import crypto from 'crypto';
import MockAdapter from 'axios-mock-adapter';
import { issueCouponNode } from '../nodes/issueCoupon';
import { createMockParams, TEST_CONNECTION, getNodeFunction } from './helpers';

const execute = getNodeFunction(issueCouponNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('issueCoupon node (POST /v1/coupons/issue)', () => {
  test('calls POST /v1/coupons/issue', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '101',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(mock.history.post.length).toBe(1);
  });

  test('sends scheduleId as a number in the body (optionals omitted)', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '101',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ scheduleId: 101 });
  });

  test('includes optional fields in body and signature when present', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '101',
      expirationDate: '2026-02-01T00:00:00Z',
      transactionId: 'txn-9',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      scheduleId: 101,
      expirationDate: '2026-02-01T00:00:00Z',
      transactionId: 'txn-9',
    });

    const expectedInput = fixedTime + '101' + '2026-02-01T00:00:00Z' + 'txn-9' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('signature = SHA256(timestamp + scheduleId + salt) with no optionals', async () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);

    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '101',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    const expectedInput = fixedTime + '101' + TEST_CONNECTION.signatureSalt;
    const expectedSig = crypto.createHash('sha256').update(expectedInput, 'utf8').digest('hex');
    expect(mock.history.post[0].headers!['X-Liquid-Signature']).toBe(expectedSig);
  });

  test('sends Authorization Bearer header', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'my-tok',
      scheduleId: '101',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(mock.history.post[0].headers!['Authorization']).toBe('Bearer my-tok');
  });

  test('stores success result in context', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(200, {});

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '101',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(contextStore['lb.coupon'].success).toBe(true);
  });

  test('handles API error', async () => {
    mock.onPost(new RegExp(`${TEST_CONNECTION.baseUrl}/v1/coupons/issue`)).reply(400, {
      detail: 'Validation failed.',
      code: 'BOOTSTRAP_VALIDATION_FAILED',
    });

    const { params, contextStore } = createMockParams({
      connection: TEST_CONNECTION,
      accessToken: 'tok',
      scheduleId: '0',
      expirationDate: '',
      transactionId: '',
      contextKey: 'lb.coupon',
    });

    await execute(params);

    expect(contextStore['lb.coupon'].error).toBeDefined();
  });
});
