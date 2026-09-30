import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IWriteOperationResult } from '../types/agentApi';

export const setPlateNumberNode = createNodeDescriptor({
  type: "setPlateNumber",
  defaultLabel: "Set Plate Number",
  summary: "Update the signed-in user's license plate number",
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
      key: "plateNumber",
      label: "Plate Number",
      type: "cognigyText",
      params: { required: true },
      description: "The new license plate number.",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.setPlateNumber",
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
      fields: ["plateNumber"],
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
    const { connection, accessToken, plateNumber, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'PUT',
        baseUrl: connection.baseUrl,
        path: '/v1/user/plate-number',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [plateNumber],
        accessToken,
        body: { plateNumber },
        log: (level, message) => api.log?.(level, message),
      });

      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', 'Set plate number succeeded');
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Set plate number failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
