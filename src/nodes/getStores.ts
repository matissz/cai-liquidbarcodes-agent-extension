import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IStoresResponse } from '../types/agentApi';

export const getStoresNode = createNodeDescriptor({
  type: "getStores",
  defaultLabel: "Get Stores",
  summary: "List stores or get a specific store by ID",

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
      description: "Liquid internal store ID. Leave empty for all stores.",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.stores",
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
      fields: ["storeId"],
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
    const { connection, accessToken, storeId, contextKey } = config as any;

    try {
      const signatureFields: string[] = [];
      const queryParams: Record<string, string> = {};

      if (storeId) {
        signatureFields.push(storeId);
        queryParams.storeId = storeId;
      }

      const response = await makeAgentApiRequest<IStoresResponse>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: '/v1/stores',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields,
        accessToken,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      });

      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', `Get stores succeeded (${response.data.Stores?.length ?? 0} stores)`);
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get stores failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
