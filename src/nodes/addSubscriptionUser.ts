import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IWriteOperationResult } from '../types/agentApi';

export const addSubscriptionUserNode = createNodeDescriptor({
  type: "addSubscriptionUser",
  defaultLabel: "Add Subscription User",
  summary: "Add a user (family member) to a multi-user subscription",

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
      key: "personalIdentifier",
      label: "Personal Identifier",
      type: "cognigyText",
      params: { required: true },
      description: "Identifier of the user to add (e.g. phone number).",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.addSubscriptionUser",
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
      fields: ["subscriptionId", "personalIdentifier"],
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
    const { connection, accessToken, subscriptionId, personalIdentifier, contextKey } = config as any;

    try {
      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: `/v1/subscriptions/${encodeURIComponent(String(subscriptionId ?? ''))}/users`,
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [String(subscriptionId ?? ''), personalIdentifier],
        accessToken,
        body: { personalIdentifier },
      });

      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', 'Add subscription user succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Add subscription user failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
