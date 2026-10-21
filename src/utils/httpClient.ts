import axios from 'axios';
import { computeSignature } from './signature';
import type { IAgentApiRequestOptions, IAgentApiResponse } from '../types/agentApi';

const REQUEST_TIMEOUT_MS = 15_000;

function redactCredentials(message: unknown, credentials: Array<unknown>): string | undefined {
  if (message === undefined || message === null) return undefined;

  return credentials.reduce<string>(
    (redacted, credential) => {
      const value = String(credential ?? '');
      return value ? redacted.split(value).join('[REDACTED]') : redacted;
    },
    String(message)
  );
}

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
  const normalizedAccessToken = String(accessToken ?? '').trim();
  const normalizedSignatureFields = signatureFields.map(field => String(field ?? '').trim());
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
    hasAuthorization: normalizedAccessToken.length > 0,
  }));

  const headers: Record<string, string> = {
    'X-Customer-Api-Key': normalizedApiKey,
    'X-Liquid-Timestamp': timestamp,
    'X-Liquid-Signature': signature,
  };

  if (normalizedAccessToken) {
    headers['Authorization'] = `Bearer ${normalizedAccessToken}`;
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
      timeout: REQUEST_TIMEOUT_MS,
    });

    log?.('info', JSON.stringify({
      event: 'lb.response.received',
      method,
      url,
      status: response.status,
    }));

    return { data: response.data as T, status: response.status };
  } catch (error: any) {
    const errorMessage = error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.message;
    log?.('error', JSON.stringify({
      event: 'lb.response.failed',
      method,
      url,
      status: error?.response?.status,
      code: error?.response?.data?.code,
      message: redactCredentials(errorMessage, [
        normalizedApiKey,
        normalizedSignatureSalt,
        normalizedAccessToken,
        ...normalizedSignatureFields,
      ]),
      traceId: error?.response?.data?.traceId,
    }));
    throw error;
  }
}
