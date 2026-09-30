import crypto from 'crypto';
import { computeSignature } from '../../utils/signature';

describe('computeSignature', () => {
  const salt = 'test-salt';
  const timestamp = '2026-01-01T00:00:00.000Z';

  test('produces lowercase hex SHA-256', () => {
    const result = computeSignature(timestamp, [], salt);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  test('matches manual SHA-256 computation', () => {
    const input = timestamp + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [], salt)).toBe(expected);
  });

  test('concatenates fields in order between timestamp and salt', () => {
    const input = timestamp + 'fieldA' + 'fieldB' + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, ['fieldA', 'fieldB'], salt)).toBe(expected);
  });

  test('omits null/undefined/empty fields', () => {
    const input = timestamp + 'fieldA' + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, ['fieldA', null, undefined, ''], salt)).toBe(expected);
  });

  test('trims all parts', () => {
    const input = timestamp + 'value' + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature('  ' + timestamp + '  ', ['  value  '], '  ' + salt + '  ')).toBe(expected);
  });

  test('handles unicode/emoji fields', () => {
    const result = computeSignature(timestamp, ['\u{1F600}', 'é'], salt);
    expect(result).toMatch(/^[0-9a-f]{64}$/);

    const input = timestamp + '\u{1F600}' + 'é' + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(result).toBe(expected);
  });

  test('different salts produce different signatures', () => {
    const sig1 = computeSignature(timestamp, ['data'], 'salt-one');
    const sig2 = computeSignature(timestamp, ['data'], 'salt-two');
    expect(sig1).not.toBe(sig2);
  });

  // Per-endpoint concatenation order from API reference
  test('SSO: timestamp + ssoToken + salt', () => {
    const ssoToken = 'Testtoken123';
    const input = timestamp + ssoToken + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [ssoToken], salt)).toBe(expected);
  });

  test('OTP start: timestamp + phone + salt', () => {
    const phone = '34111111111';
    const input = timestamp + phone + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [phone], salt)).toBe(expected);
  });

  test('OTP verify: timestamp + phone + code + salt', () => {
    const phone = '34111111111';
    const code = '3565';
    const input = timestamp + phone + code + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [phone, code], salt)).toBe(expected);
  });

  test('Get user: timestamp + salt (no fields)', () => {
    const input = timestamp + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [], salt)).toBe(expected);
  });

  test('Get stores with storeId: timestamp + storeId + salt', () => {
    const storeId = '22632';
    const input = timestamp + storeId + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [storeId], salt)).toBe(expected);
  });

  test('Get stores without storeId: timestamp + salt', () => {
    const input = timestamp + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [], salt)).toBe(expected);
  });

  test('Get receipts with both filters: timestamp + storeId + dateFrom + salt', () => {
    const storeId = '22632';
    const dateFrom = '2024-01-01T00:00:00Z';
    const input = timestamp + storeId + dateFrom + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, [storeId, dateFrom], salt)).toBe(expected);
  });

  test('Get receipts with only dateFrom: omits absent storeId', () => {
    const dateFrom = '2024-01-01T00:00:00Z';
    const input = timestamp + dateFrom + salt;
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    expect(computeSignature(timestamp, ['', dateFrom], salt)).toBe(expected);
  });
});
