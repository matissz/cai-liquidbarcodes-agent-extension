import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IUserResponse } from '../types/agentApi';

export const getUserNode = createNodeDescriptor({
  type: "getUser",
  defaultLabel: "Get User Profile",
  summary: "Retrieve the signed-in user's profile",
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
      key: "accessToken",
      label: "Access Token",
      type: "cognigyText",
      defaultValue: "{{context.liquidBarcodesAgent.session.accessToken}}",
      params: { required: true },
      description: "Bearer token from SSO or OTP Verify",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.user",
      params: { required: true },
    },
  ],

  sections: [
    {
      key: "authentication",
      label: "Authentication",
      defaultCollapsed: false,
      fields: ["connection", "accessToken"],
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
    const { connection, accessToken, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const response = await makeAgentApiRequest<IUserResponse>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: '/v1/user',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [],
        accessToken,
        log: (level, message) => api.log?.(level, message),
      });

      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', 'Get user profile succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get user profile failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
