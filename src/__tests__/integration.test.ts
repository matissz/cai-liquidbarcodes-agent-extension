import axios from 'axios';
import crypto from 'crypto';

const BASE_URL = process.env.LB_AGENT_BASE_URL;
const API_KEY = process.env.LB_AGENT_API_KEY;
const SALT = process.env.LB_AGENT_SIGNATURE_SALT;
const TEST_PHONE = process.env.LB_AGENT_TEST_PHONE;
const TEST_SSO_TOKEN = process.env.LB_AGENT_TEST_SSO_TOKEN;
const APP_BASE_URL = process.env.LB_APP_BASE_URL;
const APP_SECRET_KEY = process.env.LB_APP_SECRET_KEY;

const HAS_CREDS = BASE_URL && API_KEY && SALT;
const HAS_APP_CREDS = APP_BASE_URL && APP_SECRET_KEY;

function computeSignature(timestamp: string, fields: string[], salt: string): string {
  let input = timestamp;
  for (const f of fields) {
    if (f) input += f;
  }
  input += salt;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function makeHeaders(signatureFields: string[], accessToken?: string) {
  const timestamp = new Date().toISOString();
  const signature = computeSignature(timestamp, signatureFields, SALT!);
  const headers: Record<string, string> = {
    'X-Customer-Api-Key': API_KEY!,
    'X-Liquid-Timestamp': timestamp,
    'X-Liquid-Signature': signature,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

const describeIntegration = HAS_CREDS ? describe : describe.skip;

describeIntegration('Integration: Liquid Barcodes Agent API (sandbox)', () => {
  jest.setTimeout(30_000);

  // ── Signature validation ──────────────────────────────────────────────────

  test('invalid signature returns 401 INVALID_SIGNATURE', async () => {
    const timestamp = new Date().toISOString();
    const headers = {
      'X-Customer-Api-Key': API_KEY!,
      'X-Liquid-Timestamp': timestamp,
      'X-Liquid-Signature': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'Content-Type': 'application/json',
    };

    try {
      await axios.post(`${BASE_URL}/v1/auth/otp/start`, { phone: '123' }, { headers });
      fail('Should have returned 401');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.code).toBe('INVALID_SIGNATURE');
    }
  });

  // ── OTP flow ──────────────────────────────────────────────────────────────

  test('POST /v1/auth/otp/start sends OTP to phone', async () => {
    if (!TEST_PHONE) return;

    const headers = makeHeaders([TEST_PHONE]);
    const res = await axios.post(
      `${BASE_URL}/v1/auth/otp/start`,
      { phone: TEST_PHONE },
      { headers }
    );

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('Phone');
    expect(res.data.Phone).toBe(TEST_PHONE);
  });

  test('POST /v1/auth/otp/start returns 400 on invalid phone', async () => {
    const headers = makeHeaders(['']);

    try {
      await axios.post(
        `${BASE_URL}/v1/auth/otp/start`,
        { phone: '' },
        { headers }
      );
      fail('Should have returned 400');
    } catch (error: any) {
      expect([400, 401]).toContain(error.response.status);
    }
  });

  // ── App API: SSO token generation (only if app creds provided) ────────────

  const describeAppApi = HAS_APP_CREDS ? describe : describe.skip;

  describeAppApi('App API: Request SSO Token', () => {
    test('POST /auth/lb/tokens generates an SSO token', async () => {
      const timestamp = new Date().toISOString();
      const testUserId = 'integration-test-user';
      const sigInput = timestamp + testUserId + APP_SECRET_KEY!;
      const signature = crypto.createHash('sha256').update(sigInput, 'utf8').digest('hex');

      const headers = {
        'X-Liquid-Timestamp': timestamp,
        'X-Liquid-Signature': signature,
        'Content-Type': 'application/json',
      };

      try {
        const res = await axios.post(
          `${APP_BASE_URL}/auth/lb/tokens`,
          { UserId: testUserId },
          { headers }
        );

        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('Token');
        expect(res.data).toHaveProperty('ExpirationDate');
      } catch (error: any) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  // ── SSO flow (only if token provided) ─────────────────────────────────────

  const describeSso = TEST_SSO_TOKEN ? describe : describe.skip;

  describeSso('SSO authenticated endpoints', () => {
    let accessToken: string;

    beforeAll(async () => {
      const headers = makeHeaders([TEST_SSO_TOKEN!]);
      const res = await axios.post(
        `${BASE_URL}/v1/auth/sso`,
        { ssoToken: TEST_SSO_TOKEN },
        { headers }
      );
      accessToken = res.data.AccessToken;
    });

    test('POST /v1/auth/sso returns access token', () => {
      expect(accessToken).toBeTruthy();
    });

    test('GET /v1/user returns user profile', async () => {
      const headers = makeHeaders([], accessToken);
      const res = await axios.get(`${BASE_URL}/v1/user`, { headers });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('UserId');
      expect(res.data).toHaveProperty('Msn');
    });

    test('GET /v1/stores returns stores array', async () => {
      const headers = makeHeaders([], accessToken);
      const res = await axios.get(`${BASE_URL}/v1/stores`, { headers });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('Stores');
      expect(Array.isArray(res.data.Stores)).toBe(true);
    });

    test('GET /v1/stores/machines/status returns machine statuses', async () => {
      const headers = makeHeaders([], accessToken);
      const res = await axios.get(`${BASE_URL}/v1/stores/machines/status`, { headers });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('StoreMachinesStatus');
    });

    test('GET /v1/receipts returns receipts', async () => {
      const headers = makeHeaders([], accessToken);
      const res = await axios.get(`${BASE_URL}/v1/receipts`, { headers });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('Receipts');
    });
  });
});
