import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from 'axios';
import { computeSignature } from '../utils/signature';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { ISsoTokenResponse } from '../types/agentApi';

export const requestSsoTokenNode = createNodeDescriptor({
  type: "requestSsoToken",
  defaultLabel: "Request SSO Token",
  summary: "Generate an SSO token for a user via the App API",
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

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, userId, contextKey } = config as any;
    const normalizedAppBaseUrl = String(connection?.appBaseUrl ?? '').trim().replace(/\/+$/, '');
    const normalizedAppSecretKey = String(connection?.appSecretKey ?? '').trim();
    const normalizedUserId = String(userId ?? '').trim();
    const url = `${normalizedAppBaseUrl}/auth/lb/tokens`;
    let route: ResultRoute = 'error';

    try {
      const timestamp = new Date().toISOString();
      const signature = computeSignature(timestamp, [normalizedUserId], normalizedAppSecretKey);

      const headers: Record<string, string> = {
        'X-Liquid-Timestamp': timestamp,
        'X-Liquid-Signature': signature,
        'Content-Type': 'application/json',
      };

      api.log?.('info', JSON.stringify({
        event: 'lb.appRequest.prepared',
        method: 'POST',
        url,
        timestamp,
        appSecretKeyPresent: normalizedAppSecretKey.length > 0,
        appSecretKeyLength: normalizedAppSecretKey.length,
        userIdLength: normalizedUserId.length,
        signatureLength: signature.length,
      }));
      api.log?.('info', JSON.stringify({
        event: 'lb.appRequest.sending',
        method: 'POST',
        url,
        headerNames: Object.keys(headers),
      }));

      const response = await axios.post<ISsoTokenResponse>(url, { UserId: normalizedUserId }, { headers });

      api.log?.('info', JSON.stringify({
        event: 'lb.appResponse.received',
        method: 'POST',
        url,
        status: response.status,
      }));

      const result = {
        token: response.data.token ?? response.data.Token,
        expirationDate: response.data.expirationDate ?? response.data.ExpirationDate,
      };

      api.addToContext?.(contextKey, result, 'simple');
      api.log?.('info', 'SSO token request succeeded');
      route = 'success';
    } catch (error: any) {
      const data = error?.response?.data;
      const rs = data?.responseStatus ?? data?.ResponseStatus;
      const message = rs?.message ?? rs?.Message ?? data?.detail ?? error?.message ?? 'Unknown error';
      const code = rs?.errorCode ?? rs?.ErrorCode ?? data?.code;

      api.log?.('error', JSON.stringify({
        event: 'lb.appResponse.failed',
        method: 'POST',
        url,
        status: error?.response?.status,
        code,
        message,
        traceId: data?.traceId,
      }));
      api.addToContext?.(contextKey, { error: { message, code, status: error?.response?.status } }, 'simple');
    }

    routeToResultChild(childConfigs, api, route);
  },
});
