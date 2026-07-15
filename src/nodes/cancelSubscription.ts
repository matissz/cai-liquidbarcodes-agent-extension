import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IWriteOperationResult } from '../types/agentApi';

export const cancelSubscriptionNode = createNodeDescriptor({
  type: "cancelSubscription",
  defaultLabel: "Cancel Subscription",
  summary: "Cancel a user's subscription by ID",

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
      description: "The SubscriptionId to cancel (from Get User Profile).",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.cancelSubscription",
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
      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/subscriptions/cancel',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [String(subscriptionId ?? '')],
        accessToken,
        body: { subscriptionId: Number(subscriptionId) },
      });

      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', 'Cancel subscription succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Cancel subscription failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
