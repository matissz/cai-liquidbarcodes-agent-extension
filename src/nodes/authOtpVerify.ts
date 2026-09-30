import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IOtpVerifyResponse } from '../types/agentApi';

export const authOtpVerifyNode = createNodeDescriptor({
  type: "authOtpVerify",
  defaultLabel: "Verify OTP",
  summary: "Verify OTP code and obtain access token",

  fields: [
    {
      key: "connection",
      label: "Connection",
      type: "connection",
      params: { connectionType: "liquid-barcodes-agent-api", required: true },
    },
    {
      key: "phone",
      label: "Phone Number",
      type: "cognigyText",
      params: { required: true },
      description: "Same phone number used on Start OTP",
    },
    {
      key: "code",
      label: "OTP Code",
      type: "cognigyText",
      params: { required: true },
      description: "Code received via SMS",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.session",
      params: { required: true },
    },
  ],

  sections: [
    {
      key: "otpVerification",
      label: "OTP Verification",
      defaultCollapsed: false,
      fields: ["connection", "phone", "code"],
    },
    {
      key: "output",
      label: "Output Settings",
      defaultCollapsed: true,
      fields: ["contextKey"],
    },
  ],

  form: [
    { type: "section", key: "otpVerification" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, phone, code, contextKey } = config as any;
    const normalizedPhone = String(phone ?? '').trim();
    const normalizedCode = String(code ?? '').trim();

    try {
      const response = await makeAgentApiRequest<IOtpVerifyResponse>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/auth/otp/verify',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [normalizedPhone, normalizedCode],
        body: { phone: normalizedPhone, code: normalizedCode },
        log: (level, message) => api.log?.(level, message),
      });

      const accessToken = response.data.accessToken ?? response.data.AccessToken;
      const expiresInSeconds = response.data.expiresInSeconds ?? response.data.ExpiresInSeconds;
      if (typeof accessToken !== 'string' || !accessToken.trim() || !Number.isFinite(expiresInSeconds) || expiresInSeconds! <= 0) {
        throw new Error('Liquid Barcodes returned an invalid OTP session response.');
      }

      const result = { accessToken, expiresInSeconds };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'OTP verification succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `OTP verification failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
