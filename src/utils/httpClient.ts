import axios from 'axios';
import { computeSignature } from './signature';
import type { IAgentApiRequestOptions, IAgentApiResponse } from '../types/agentApi';

export async function makeAgentApiRequest<T = any>(
  options: IAgentApiRequestOptions
): Promise<IAgentApiResponse<T>> {
  const {
    method,
    baseUrl,
    path,
    apiKey,
    signatureSalt,
    signatureFields,
    accessToken,
    body,
    queryParams,
    log,
  } = options;

  const normalizedBaseUrl = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  const normalizedApiKey = String(apiKey ?? '').trim();
  const normalizedSignatureSalt = String(signatureSalt ?? '').trim();
  const timestamp = new Date().toISOString();
  const signature = computeSignature(timestamp, signatureFields, normalizedSignatureSalt);
  const url = `${normalizedBaseUrl}${path}`;

  log?.('info', JSON.stringify({
    event: 'lb.request.prepared',
    method,
    url,
    timestamp,
    apiKeyPresent: normalizedApiKey.length > 0,
    apiKeyLength: normalizedApiKey.length,
    signatureSaltPresent: normalizedSignatureSalt.length > 0,
    signatureSaltLength: normalizedSignatureSalt.length,
    signatureFieldLengths: signatureFields.map(field => String(field ?? '').trim().length),
    signatureLength: signature.length,
    hasAuthorization: Boolean(accessToken),
  }));

  const headers: Record<string, string> = {
    'X-Customer-Api-Key': normalizedApiKey,
    'X-Liquid-Timestamp': timestamp,
    'X-Liquid-Signature': signature,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const sendsBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  if (sendsBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    log?.('info', JSON.stringify({
      event: 'lb.request.sending',
      method,
      url,
      headerNames: Object.keys(headers),
    }));

    const response = await axios({
      method,
      url,
      headers,
      data: sendsBody ? body : undefined,
      params: queryParams,
    });

    log?.('info', JSON.stringify({
      event: 'lb.response.received',
      method,
      url,
      status: response.status,
    }));

    return { data: response.data as T, status: response.status };
  } catch (error: any) {
    log?.('error', JSON.stringify({
      event: 'lb.response.failed',
      method,
      url,
      status: error?.response?.status,
      code: error?.response?.data?.code,
      message: error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.message,
      traceId: error?.response?.data?.traceId,
    }));
    throw error;
  }
}
