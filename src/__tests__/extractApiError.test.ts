import { extractApiError } from '../utils/extractApiError';

describe('extractApiError', () => {
  describe('RFC problem-details branch (code + detail)', () => {
    test('maps detail/code/status/traceId', () => {
      const error = {
        response: {
          status: 400,
          data: {
            code: 'INVALID_REQUEST',
            detail: 'The request body was invalid',
            status: 400,
            traceId: 'trace-123',
          },
        },
      };

      expect(extractApiError(error)).toEqual({
        message: 'The request body was invalid',
        code: 'INVALID_REQUEST',
        status: 400,
        traceId: 'trace-123',
      });
    });

    test('leaves status/traceId undefined when absent from data', () => {
      const error = {
        response: { data: { code: 'FORBIDDEN', detail: 'Not allowed' } },
      };

      expect(extractApiError(error)).toEqual({
        message: 'Not allowed',
        code: 'FORBIDDEN',
        status: undefined,
        traceId: undefined,
      });
    });

    test('falls through when only code is present (no detail)', () => {
      const error = {
        response: { status: 500, data: { code: 'ERR' } },
      };

      // No detail => not the problem-details branch; falls to HTTP-status fallback.
      expect(extractApiError(error)).toEqual({
        message: 'HTTP 500: undefined',
        status: 500,
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
        status: undefined,
        traceId: undefined,
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
    test('uses error.message when there is no response', () => {
      const error = new Error('Network Error');

      expect(extractApiError(error)).toEqual({ message: 'Network Error' });
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
