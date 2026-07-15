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
  } = options;

  const timestamp = new Date().toISOString();
  const signature = computeSignature(timestamp, signatureFields, signatureSalt);

  const headers: Record<string, string> = {
    'X-Customer-Api-Key': apiKey,
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

  const url = `${baseUrl}${path}`;

  const response = await axios({
    method,
    url,
    headers,
    data: sendsBody ? body : undefined,
    params: queryParams,
  });

  return { data: response.data as T, status: response.status };
}
