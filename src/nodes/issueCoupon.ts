import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import type { IIssueCouponRequest, IWriteOperationResult } from '../types/agentApi';

export const issueCouponNode = createNodeDescriptor({
  type: "issueCoupon",
  defaultLabel: "Issue Coupon",
  summary: "Issue a coupon (e.g. a single wash code) to the signed-in user",

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
      key: "scheduleId",
      label: "Schedule ID",
      type: "cognigyText",
      params: { required: true },
      description: "The coupon schedule ID to issue (provided by Liquid Barcodes).",
    },
    {
      key: "expirationDate",
      label: "Expiration Date",
      type: "cognigyText",
      description: "Optional ISO 8601 expiration date/time for the issued coupon.",
    },
    {
      key: "transactionId",
      label: "Transaction ID",
      type: "cognigyText",
      description: "Optional caller-supplied transaction reference.",
    },
    {
      key: "contextKey",
      label: "Store Result In",
      type: "cognigyText",
      defaultValue: "liquidBarcodesAgent.issueCoupon",
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
      fields: ["scheduleId", "expirationDate", "transactionId"],
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
    const { connection, accessToken, scheduleId, expirationDate, transactionId, contextKey } = config as any;

    try {
      const signatureFields: string[] = [String(scheduleId ?? '')];
      const body: IIssueCouponRequest = { scheduleId: Number(scheduleId) };

      if (expirationDate) {
        signatureFields.push(expirationDate);
        body.expirationDate = expirationDate;
      }
      if (transactionId) {
        signatureFields.push(transactionId);
        body.transactionId = transactionId;
      }

      const response = await makeAgentApiRequest<IWriteOperationResult>({
        method: 'POST',
        baseUrl: connection.baseUrl,
        path: '/v1/coupons/issue',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields,
        accessToken,
        body: body as unknown as Record<string, any>,
      });

      api.addToContext?.(contextKey, { success: true, data: response.data ?? null }, 'simple');
      api.log?.('info', 'Issue coupon succeeded');
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Issue coupon failed: ${apiError.message}`);
      api.addToContext?.(contextKey, { error: apiError }, 'simple');
    }
  },
});
