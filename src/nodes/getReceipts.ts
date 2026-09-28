import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IReceiptsResponse } from '../types/agentApi';

export const getReceiptsNode = createNodeDescriptor({
  type: "getReceipts",
  defaultLabel: "Get Receipts",
  summary: "Retrieve user receipts with optional filters",

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
      key: "storeId",
      label: "Store ID",
      type: "cognigyText",
      description: "Limits receipts to this store. Use the store ID from Get Stores.",
    },
    {
      key: "dateFrom",
      label: "Date From",
      type: "cognigyText",
      description: "ISO 8601 datetime. Limits receipts from this date onwards.",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.receipts",
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
      key: "filters",
      label: "Filters",
      defaultCollapsed: false,
      fields: ["storeId", "dateFrom"],
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
    { type: "section", key: "filters" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, storeId, dateFrom, contextKey } = config as any;

    try {
      const signatureFields: string[] = [];
      const queryParams: Record<string, string> = {};

      if (storeId) {
        signatureFields.push(storeId);
        queryParams.storeId = storeId;
      }
      if (dateFrom) {
        signatureFields.push(dateFrom);
        queryParams.dateFrom = dateFrom;
      }

      const response = await makeAgentApiRequest<IReceiptsResponse>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: '/v1/receipts',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields,
        accessToken,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        log: (level, message) => api.log?.(level, message),
      });

      const receipts = response.data.receipts ?? response.data.Receipts ?? [];
      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', `Get receipts succeeded (${receipts.length} receipts)`);
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get receipts failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
