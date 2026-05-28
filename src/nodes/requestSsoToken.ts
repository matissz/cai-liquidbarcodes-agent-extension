import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from 'axios';
import { computeSignature } from '../utils/signature';
import type { ISsoTokenResponse } from '../types/agentApi';

export const requestSsoTokenNode = createNodeDescriptor({
  type: "requestSsoToken",
  defaultLabel: "Request SSO Token",
  summary: "Generate an SSO token for a user via the App API",

  fields: [
    {
      key: "connection",
      label: "Connection",
      type: "connection",
      params: { connectionType: "liquid-barcodes-agent-api", required: true },
    },
    {
      key: "userId",
      label: "User ID",
      type: "cognigyText",
      params: { required: true },
      description: "The Liquid Barcodes UserId to generate an SSO token for",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.ssoToken",
      params: { required: true },
    },
  ],

  sections: [
    {
      key: "request",
      label: "Request",
      defaultCollapsed: false,
      fields: ["connection", "userId"],
    },
    {
      key: "output",
      label: "Output Settings",
      defaultCollapsed: true,
      fields: ["contextKey"],
    },
  ],

  form: [
    { type: "section", key: "request" },
    { type: "section", key: "output" },
  ],

  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, userId, contextKey } = config as any;

    try {
      const timestamp = new Date().toISOString();
      const signature = computeSignature(timestamp, [userId], connection.appSecretKey);

      const url = `${connection.appBaseUrl}/auth/lb/tokens`;
      const headers: Record<string, string> = {
        'X-Liquid-Timestamp': timestamp,
        'X-Liquid-Signature': signature,
        'Content-Type': 'application/json',
      };

      const response = await axios.post<ISsoTokenResponse>(url, { UserId: userId }, { headers });

      const result = {
        token: response.data.Token,
        expirationDate: response.data.ExpirationDate,
      };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'SSO token request succeeded');
    } catch (error: any) {
      const data = error?.response?.data;
      const rs = data?.ResponseStatus;
      const message = rs?.Message || data?.detail || error?.message || 'Unknown error';
      const code = rs?.ErrorCode || data?.code;

      api.log?.('error', `SSO token request failed: ${message}`);
      api.addToContext?.(contextKey, { error: { message, code, status: error?.response?.status } }, 'simple');
    }
  },
});
