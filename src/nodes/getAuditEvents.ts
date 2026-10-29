import { createNodeDescriptor, INodeFunctionBaseParams } from '@cognigy/extension-tools';
import { makeAgentApiRequest } from '../utils/httpClient';
import { extractApiError } from '../utils/extractApiError';
import { clearApiError, storeApiError } from '../utils/errorHandling';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IAuditEvent } from '../types/agentApi';

export const getAuditEventsNode = createNodeDescriptor({
  type: 'getAuditEvents',
  defaultLabel: 'Get Audit Events',
  summary: 'Retrieve Agent API audit events for a customer',
  constraints: RESULT_CHILD_CONSTRAINTS,
  dependencies: RESULT_CHILD_DEPENDENCIES,

  fields: [
    {
      key: 'connection',
      label: 'Connection',
      type: 'connection',
      params: { connectionType: 'liquid-barcodes-agent-api', required: true },
    },
    {
      key: 'userId',
      label: 'User ID',
      type: 'cognigyText',
      description: 'Customer user ID. Supply exactly one of User ID or Phone.',
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'cognigyText',
      description: 'Digits-only phone number. Supply exactly one of User ID or Phone.',
    },
    {
      key: 'limit',
      label: 'Limit',
      type: 'cognigyText',
      defaultValue: '100',
      description: 'Maximum events to return (1-500).',
    },
    {
      key: 'contextKey',
      label: 'Store Result In',
      type: 'cognigyText',
      defaultValue: 'liquidBarcodesAgent.auditEvents',
      params: { required: true },
    },
  ],

  sections: [
    {
      key: 'connection',
      label: 'Connection',
      defaultCollapsed: false,
      fields: ['connection'],
    },
    {
      key: 'request',
      label: 'Request',
      defaultCollapsed: false,
      fields: ['userId', 'phone', 'limit'],
    },
    {
      key: 'output',
      label: 'Output Settings',
      defaultCollapsed: true,
      fields: ['contextKey'],
    },
  ],

  form: [
    { type: 'section', key: 'connection' },
    { type: 'section', key: 'request' },
    { type: 'section', key: 'output' },
  ],

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { connection, userId, phone, limit, contextKey } = config as any;
    const normalizedUserId = String(userId ?? '').trim();
    const normalizedPhone = String(phone ?? '').trim();
    const normalizedLimit = String(limit ?? '100').trim() || '100';
    const numericLimit = Number(normalizedLimit);
    let route: ResultRoute = 'error';

    try {
      if (Boolean(normalizedUserId) === Boolean(normalizedPhone)) {
        throw new Error('Supply exactly one of User ID or Phone.');
      }
      if ((normalizedUserId && !/^\d+$/.test(normalizedUserId)) || (normalizedPhone && !/^\d{7,13}$/.test(normalizedPhone))) {
        throw new Error('User ID and Phone must contain digits only; Phone must contain 7-13 digits.');
      }
      if (!Number.isInteger(numericLimit) || numericLimit < 1 || numericLimit > 500) {
        throw new Error('Limit must be an integer from 1 to 500.');
      }

      const response = await makeAgentApiRequest<IAuditEvent[]>({
        method: 'GET',
        baseUrl: connection.baseUrl,
        path: '/v1/audit-events',
        apiKey: connection.apiKey,
        signatureSalt: connection.signatureSalt,
        signatureFields: [normalizedUserId, normalizedPhone, normalizedLimit],
        queryParams: {
          ...(normalizedUserId ? { userId: normalizedUserId } : { phone: normalizedPhone }),
          limit: normalizedLimit,
        },
        log: (level, message) => api.log?.(level, message),
      });

      api.addToContext?.(contextKey, response.data, 'simple');
      api.log?.('info', 'Get audit events succeeded');
      clearApiError(api);
      route = 'success';
    } catch (error: any) {
      const apiError = extractApiError(error);
      api.log?.('error', `Get audit events failed: ${apiError.message}`);
      storeApiError(api, contextKey, 'getAuditEvents', 'protectedRead', apiError);
    }

    routeToResultChild(childConfigs, api, route);
  },
});
