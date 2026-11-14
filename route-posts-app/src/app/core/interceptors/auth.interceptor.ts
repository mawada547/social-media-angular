import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../config/api.config';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = ['/users/signin', '/users/signup'] as const;

/**
 * Attaches the stored Bearer token to protected Route Posts API requests
 * without overwriting an existing Authorization header.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const apiConfig = inject(API_CONFIG);
  const isApiRequest =
    req.url.startsWith(apiConfig.baseUrl) || !/^https?:\/\//i.test(req.url);

  if (!isApiRequest) {
    return next(req);
  }

  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) =>
    req.url.includes(path)
  );
  if (isPublicAuthRequest) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const authorizedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authorizedReq);
};
