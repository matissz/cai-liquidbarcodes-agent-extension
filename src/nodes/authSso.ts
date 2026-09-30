import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { ISsoResponse } from '../types/agentApi';

export const authSsoNode = createNodeDescriptor({
  type: "authSso",
  defaultLabel: "Exchange SSO Token",
  summary: "Exchange an SSO token for an access token",
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

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, ssoToken, contextKey } = config as any;
    const normalizedSsoToken = String(ssoToken ?? '').trim();
    let route: ResultRoute = 'error';

    try {
      const response = await makeAgentApiRequest<ISsoResponse>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/auth/sso',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [normalizedSsoToken],
        body: { ssoToken: normalizedSsoToken },
        log: (level, message) => api.log?.(level, message),
      });

      const accessToken = response.data.accessToken ?? response.data.AccessToken;
      const expiresInSeconds = response.data.expiresInSeconds ?? response.data.ExpiresInSeconds;
      if (typeof accessToken !== 'string' || !accessToken.trim() || !Number.isFinite(expiresInSeconds) || expiresInSeconds! <= 0) {
        throw new Error('Liquid Barcodes returned an invalid SSO session response.');
      }

      const result = { accessToken, expiresInSeconds };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'SSO token exchange succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `SSO token exchange failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
