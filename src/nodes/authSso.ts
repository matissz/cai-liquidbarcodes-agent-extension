import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { ISsoResponse } from '../types/agentApi';

export const authSsoNode = createNodeDescriptor({
  type: "authSso",
  defaultLabel: "Exchange SSO Token",
  summary: "Exchange an SSO token for an access token",

  fields: [
    {
      key: "connection",
      label: "Connection",
      type: "connection",
      params: { connectionType: "liquid-barcodes-agent-api", required: true },
    },
    {
      key: "ssoToken",
      label: "SSO Token",
      type: "cognigyText",
      defaultValue: "{{context.liquidBarcodesAgent.ssoToken.token}}",
      params: { required: true },
      description: "One-time SSO token from the in-app flow",
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
      key: "authentication",
      label: "Authentication",
      defaultCollapsed: false,
      fields: ["connection", "ssoToken"],
    },
    {
      key: "output",
      label: "Output Settings",
      defaultCollapsed: true,
      fields: ["contextKey"],
    },
  ],

  form: [
    { type: "section", key: "authentication" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, ssoToken, contextKey } = config as any;

    try {
      const response = await makeAgentApiRequest<ISsoResponse>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/auth/sso',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [ssoToken],
        body: { ssoToken },
        log: (level, message) => api.log?.(level, message),
      });

      const result = {
        accessToken: response.data.AccessToken,
        expiresInSeconds: response.data.ExpiresInSeconds,
      };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'SSO token exchange succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `SSO token exchange failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
