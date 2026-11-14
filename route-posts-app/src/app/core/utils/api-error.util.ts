import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extracts user-friendly error messages from Route Posts API error responses.
 */
export function extractApiErrorMessages(error: unknown, fallbackMessage: string): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [fallbackMessage];
  }

  if (error.status === 0) {
    return ['Unable to reach the server. Please check your internet connection and try again.'];
  }

  const body = error.error as
    | { readonly message?: unknown; readonly errors?: unknown }
    | string
    | null
    | undefined;

  if (!body) {
    return [fallbackMessage];
  }

  if (typeof body === 'string' && body.trim().length > 0) {
    return [body.trim()];
  }

  if (typeof body === 'object') {
    if (Array.isArray(body.errors)) {
      const messages = body.errors
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
      if (messages.length > 0) {
        return messages;
      }
    }

    if (typeof body.errors === 'string' && body.errors.trim().length > 0) {
      return splitValidationErrors(body.errors);
    }

    if (typeof body.message === 'string' && body.message.trim().length > 0) {
      return splitValidationErrors(body.message);
    }
  }

  return [fallbackMessage];
}

function splitValidationErrors(raw: string): string[] {
  // Split Joi-style comma-separated field errors without breaking regex quantifiers like {3,30}
  return raw
    .split(/,(?=")/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

