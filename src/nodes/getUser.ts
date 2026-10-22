import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { clearApiError, storeApiError } from '../utils/errorHandling';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import {
  CancellationSelectionInputError,
  parseAllowedPlanIds,
  selectCancellationSubscription,
} from '../utils/selectCancellationSubscription';
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
      key: "allowedPlanIds",
      label: "Allowed Car-Wash Plan IDs",
      type: "cognigyText",
      params: { required: true },
      description: "A JSON array of allowed car-wash plan IDs, for example [42, 108].",
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
      key: "selection",
      label: "Cancellation Selection",
      defaultCollapsed: false,
      fields: ["allowedPlanIds"],
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
    { type: "section", key: "selection" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, allowedPlanIds, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const parsedAllowedPlanIds = parseAllowedPlanIds(allowedPlanIds);
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

      const cancellationSelection = selectCancellationSubscription(response.data, parsedAllowedPlanIds);
      api.addToContext?.(contextKey, { ...response.data, cancellationSelection }, 'simple');
      api.log?.('info', 'Get user profile succeeded');
      clearApiError(api);
      route = 'success';
    } catch (error: any) {
      const apiError = error instanceof CancellationSelectionInputError
        ? { message: error.message, code: 'InvalidInput', errorCode: 1001, status: 400 }
        : extractApiError(error);
      api.log?.('error', `Get user profile failed: ${apiError.message}`);
      storeApiError(api, contextKey, 'getUser', 'protectedRead', apiError);
    }

    routeToResultChild(childConfigs, api, route);
  },
});
