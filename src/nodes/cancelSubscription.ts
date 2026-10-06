import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { storeApiError } from '../utils/errorHandling';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IWriteOperationResult } from '../types/agentApi';

export const cancelSubscriptionNode = createNodeDescriptor({
  type: "cancelSubscription",
  defaultLabel: "Cancel Subscription",
  summary: "Cancel a user's subscription by ID",
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

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, subscriptionId, contextKey } = config as any;
    const normalizedSubscriptionId = String(subscriptionId ?? '').trim();
    const numericSubscriptionId = Number(normalizedSubscriptionId);
    let route: ResultRoute = 'error';

    api.log?.('info', JSON.stringify({
      event: 'lb.cancel.started',
      baseUrl: String(connection?.baseUrl ?? '').trim().replace(/\/+$/, ''),
      apiKeyPresent: String(connection?.apiKey ?? '').trim().length > 0,
      apiKeyLength: String(connection?.apiKey ?? '').trim().length,
      signatureSaltPresent: String(connection?.signatureSalt ?? '').trim().length > 0,
      signatureSaltLength: String(connection?.signatureSalt ?? '').trim().length,
      accessTokenPresent: String(accessToken ?? '').trim().length > 0,
      subscriptionId: normalizedSubscriptionId,
      subscriptionIdValid: Number.isSafeInteger(numericSubscriptionId) && numericSubscriptionId > 0,
      contextKey,
    }));

    try {
      api.log?.('info', JSON.stringify({
        event: 'lb.cancel.callingApi',
        subscriptionId: normalizedSubscriptionId,
      }));

      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/subscriptions/cancel',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [normalizedSubscriptionId],
        accessToken,
        body: { subscriptionId: numericSubscriptionId },
        log: (level, message) => api.log?.(level, message),
      });

      api.log?.('info', JSON.stringify({
        event: 'lb.cancel.apiSucceeded',
        status: response.status,
        subscriptionId: normalizedSubscriptionId,
      }));
      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', JSON.stringify({
        event: 'lb.cancel.contextStored',
        contextKey,
        success: true,
      }));
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', JSON.stringify({
        event: 'lb.cancel.apiFailed',
        subscriptionId: normalizedSubscriptionId,
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        traceId: apiError.traceId,
      }));
      storeApiError(api, contextKey, 'cancelSubscription', 'protectedWrite', apiError);
      api.log?.('info', JSON.stringify({
        event: 'lb.cancel.contextStored',
        contextKey,
        success: false,
      }));
    }

    routeToResultChild(childConfigs, api, route);
  },
});
