import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IStoreMachinesStatusResponse } from '../types/agentApi';

export const getStoresMachinesStatusNode = createNodeDescriptor({
  type: "getStoresMachinesStatus",
  defaultLabel: "Get Machine Status",
  summary: "Retrieve machine statuses for all stores",
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
      key: "lastUpdateTime",
      label: "Last Update Time",
      type: "cognigyText",
      description: "ISO 8601 datetime. Only returns statuses changed after this time.",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.machineStatus",
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
      defaultCollapsed: true,
      fields: ["lastUpdateTime"],
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

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, accessToken, lastUpdateTime, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const signatureFields: string[] = [];
      const queryParams: Record<string, string> = {};

      if (lastUpdateTime) {
        signatureFields.push(lastUpdateTime);
        queryParams.lastUpdateTime = lastUpdateTime;
      }

      const response = await makeAgentApiRequest<IStoreMachinesStatusResponse>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: '/v1/stores/machines/status',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields,
        accessToken,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        log: (level, message) => api.log?.(level, message),
      });

      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', 'Get machine status succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get machine status failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
