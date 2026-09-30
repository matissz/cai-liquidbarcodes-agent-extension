export function extractApiError(error: any): {
  message: string;
  code?: string;
  errorCode?: number | string;
  status?: number;
  traceId?: string;
} {
  const data = error?.response?.data;

  if (data?.code && data?.detail) {
    return {
      message: data.detail,
      code: data.code,
      errorCode: data.errorCode,
      status: data.status,
      traceId: data.traceId,
    };
  }

  if (data?.title) {
    return {
      message: data.title,
      status: data.status,
      traceId: data.traceId,
    };
  }

  const status = error?.response?.status;
  if (status) {
    return { message: `HTTP ${status}: ${error.message}`, status };
  }

  return { message: error?.message || 'Unknown error' };
}
