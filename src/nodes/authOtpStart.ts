import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IOtpStartResponse } from '../types/agentApi';

export const authOtpStartNode = createNodeDescriptor({
  type: "authOtpStart",
  defaultLabel: "Start OTP",
  summary: "Send OTP code via SMS to a phone number",
  constraints: RESULT_CHILD_CONSTRAINTS,
  dependencies: RESULT_CHILD_DEPENDENCIES,

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
      description: "Digits only, country code included, no leading +. Example: 34111111111",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.otpStart",
      params: { required: true },
    },
  ],

  sections: [
    {
      key: "otpRequest",
      label: "OTP Request",
      defaultCollapsed: false,
      fields: ["connection", "phone"],
    },
    {
      key: "output",
      label: "Output Settings",
      defaultCollapsed: true,
      fields: ["contextKey"],
    },
  ],

  form: [
    { type: "section", key: "otpRequest" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, phone, contextKey } = config as any;
    const normalizedPhone = String(phone ?? '').trim();
    let route: ResultRoute = 'error';

    try {
      const response = await makeAgentApiRequest<IOtpStartResponse>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/auth/otp/start',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [normalizedPhone],
        body: { phone: normalizedPhone },
        log: (level, message) => api.log?.(level, message),
      });

      const result = {
        phone: response.data.phone ?? response.data.Phone ?? normalizedPhone,
      };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'OTP start succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `OTP start failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
