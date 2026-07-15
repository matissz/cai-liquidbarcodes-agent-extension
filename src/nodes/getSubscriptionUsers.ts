import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { ISubscriptionUsersResponse } from '../types/agentApi';

export const getSubscriptionUsersNode = createNodeDescriptor({
  type: "getSubscriptionUsers",
  defaultLabel: "Get Subscription Users",
  summary: "List the users (family members) on a multi-user subscription",

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
      description: "The multi-user SubscriptionId (from Get User Profile).",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.subscriptionUsers",
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
      fields: ["subscriptionId"],
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

  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, subscriptionId, contextKey } = config as any;

    try {
      const response = await makeAgentApiRequest<ISubscriptionUsersResponse>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: `/v1/subscriptions/${encodeURIComponent(String(subscriptionId ?? ''))}/users`,
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [String(subscriptionId ?? '')],
        accessToken,
      });

      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', 'Get subscription users succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get subscription users failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
