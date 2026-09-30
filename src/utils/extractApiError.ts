export function extractApiError(error: any): {
  message: string;
  code?: string;
  errorCode?: number | string;
  status?: number;
  traceId?: string;
} {
  const data = error?.response?.data;

  if (data?.code) {
    return {
      message: data.detail ?? data.title ?? error?.message ?? `HTTP ${error?.response?.status ?? 'error'}`,
      code: data.code,
      errorCode: data.errorCode,
      status: data.status ?? error?.response?.status,
      traceId: data.traceId,
    };
  }

  if (data?.title) {
    return {
      message: data.title,
      status: data.status ?? error?.response?.status,
      traceId: data.traceId,
    };
  }

  const status = error?.response?.status;
  if (status) {
    return { message: `HTTP ${status}: ${error.message}`, status };
  }

  return { message: error?.message || 'Unknown error' };
}
