import type { NormalizedApiError } from './errorHandling';

export function extractApiError(error: any): NormalizedApiError {
  const response = error?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data : undefined;
  const status = data?.status ?? response?.status;
  const retryAfter = response?.headers?.['retry-after'] ?? response?.headers?.get?.('retry-after');

  if (response) {
    const detail = typeof data?.detail === 'string' ? data.detail : undefined;
    const title = typeof data?.title === 'string' ? data.title : undefined;
    return {
      message: detail ?? title ?? (status ? `HTTP ${status}: ${error?.message ?? 'Request failed'}` : error?.message ?? 'Unknown error'),
      ...(detail ? { detail } : {}),
      ...(typeof data?.code === 'string' ? { code: data.code } : {}),
      ...(data?.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(typeof data?.instance === 'string' ? { instance: data.instance } : {}),
      ...(typeof data?.traceId === 'string' ? { traceId: data.traceId } : {}),
      ...(retryAfter !== undefined ? { retryAfter } : {}),
    };
  }

  const timeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(error?.message ?? '');
  return {
    message: error?.message || 'Unknown error',
    ...(error?.isAxiosError || error?.request || timeout ? { transportFailure: timeout ? 'timeout' : 'network' } : {}),
  };
}
