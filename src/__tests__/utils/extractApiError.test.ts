import { extractApiError } from '../../utils/extractApiError';

describe('extractApiError', () => {
  describe('RFC problem-details branch (code + detail)', () => {
    test('maps detail/code/status/traceId', () => {
      const error = {
        response: {
          status: 400,
          data: {
            code: 'INVALID_REQUEST',
            errorCode: 1001,
            detail: 'The request body was invalid',
            status: 400,
            traceId: 'trace-123',
          },
        },
      };

      expect(extractApiError(error)).toEqual({
        message: 'The request body was invalid',
        detail: 'The request body was invalid',
        code: 'INVALID_REQUEST',
        errorCode: 1001,
        status: 400,
        traceId: 'trace-123',
      });
    });

    test('preserves the complete Agent API bootstrap validation error', () => {
      const error = {
        response: {
          status: 400,
          data: {
            code: 'BOOTSTRAP_VALIDATION_FAILED',
            detail: 'The request body was invalid.',
            status: 400,
            traceId: 'trace-bootstrap',
          },
        },
      };

      expect(extractApiError(error)).toEqual({
        message: 'The request body was invalid.',
        detail: 'The request body was invalid.',
        code: 'BOOTSTRAP_VALIDATION_FAILED',
        status: 400,
        traceId: 'trace-bootstrap',
      });
    });

    test('falls back to the HTTP response status when absent from data', () => {
      const error = {
        response: { status: 403, data: { code: 'FORBIDDEN', detail: 'Not allowed' } },
      };

      expect(extractApiError(error)).toEqual({
        message: 'Not allowed',
        detail: 'Not allowed',
        code: 'FORBIDDEN',
        status: 403,
      });
    });

    test('preserves problem details when code is present without detail', () => {
      const error = {
        message: 'Request failed with status code 500',
        response: { status: 500, data: { code: 'ERR', errorCode: 1003, traceId: 'trace-partial' } },
      };

      expect(extractApiError(error)).toEqual({
        message: 'HTTP 500: Request failed with status code 500',
        code: 'ERR',
        errorCode: 1003,
        status: 500,
        traceId: 'trace-partial',
      });
    });
  });

  describe('title-only branch', () => {
    test('maps title/status/traceId when code+detail absent', () => {
      const error = {
        response: {
          status: 404,
          data: { title: 'Resource not found', status: 404, traceId: 'trace-abc' },
        },
      };

      expect(extractApiError(error)).toEqual({
        message: 'Resource not found',
        status: 404,
        traceId: 'trace-abc',
      });
    });

    test('title takes precedence over the HTTP-status fallback', () => {
      const error = {
        response: { status: 409, data: { title: 'Conflict' } },
      };

      expect(extractApiError(error)).toEqual({
        message: 'Conflict',
        status: 409,
      });
    });
  });

  describe('HTTP-status fallback branch', () => {
    test('formats "HTTP {status}: {message}" when data has no code/detail/title', () => {
      const error = {
        message: 'Request failed with status code 502',
        response: { status: 502, data: {} },
      };

      expect(extractApiError(error)).toEqual({
        message: 'HTTP 502: Request failed with status code 502',
        status: 502,
      });
    });

    test('applies when response has a status but no data at all', () => {
      const error = { message: 'boom', response: { status: 503 } };

      expect(extractApiError(error)).toEqual({
        message: 'HTTP 503: boom',
        status: 503,
      });
    });
  });

  describe('bare fallback branch', () => {
    test('classifies an Axios no-response failure as network transport failure', () => {
      const error = { message: 'Network Error', isAxiosError: true, request: {} };

      expect(extractApiError(error)).toEqual({ message: 'Network Error', transportFailure: 'network' });
    });

    test('classifies an Axios timeout', () => {
      expect(extractApiError({ message: 'timeout of 1000ms exceeded', code: 'ECONNABORTED', isAxiosError: true }))
        .toEqual({ message: 'timeout of 1000ms exceeded', transportFailure: 'timeout' });
    });

    test('retains instance and retry timing', () => {
      expect(extractApiError({
        response: {
          status: 429,
          headers: { 'retry-after': '30' },
          data: { title: 'Limited', instance: '/v1/user', traceId: 'trace-limit' },
        },
      })).toEqual({
        message: 'Limited', status: 429, instance: '/v1/user', traceId: 'trace-limit', retryAfter: '30',
      });
    });

    test('returns "Unknown error" when no message is available', () => {
      expect(extractApiError({})).toEqual({ message: 'Unknown error' });
    });

    test('returns "Unknown error" for null/undefined input', () => {
      expect(extractApiError(null)).toEqual({ message: 'Unknown error' });
      expect(extractApiError(undefined)).toEqual({ message: 'Unknown error' });
    });
  });
});
