import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IWriteOperationResult } from '../types/agentApi';

export const removeSubscriptionUserNode = createNodeDescriptor({
  type: "removeSubscriptionUser",
  defaultLabel: "Remove Subscription User",
  summary: "Remove a user (family member) from a multi-user subscription",
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
      key: "subscriptionId",
      label: "Subscription ID",
      type: "cognigyText",
      params: { required: true },
      description: "The multi-user SubscriptionId (owner only).",
    },
    {
      key: "userId",
      label: "Subscription User ID",
      type: "cognigyText",
      params: { required: true },
      description: "The Id of the subscription user to remove (from Get Subscription Users).",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.removeSubscriptionUser",
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
      key: "request",
      label: "Request",
      defaultCollapsed: false,
      fields: ["subscriptionId", "userId"],
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
    { type: "section", key: "request" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, subscriptionId, userId, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'DELETE',
        baseUrl: connection.baseUrl,
        path: `/v1/subscriptions/${encodeURIComponent(String(subscriptionId ?? ''))}/users/${encodeURIComponent(String(userId ?? ''))}`,
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [String(subscriptionId ?? ''), String(userId ?? '')],
        accessToken,
        log: (level, message) => api.log?.(level, message),
      });

      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', 'Remove subscription user succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Remove subscription user failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
