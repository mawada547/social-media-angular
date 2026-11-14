import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { routes } from '../../app.routes';
import { API_CONFIG } from '../config/api.config';
import { authGuard } from '../guards/auth.guard';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';

describe('Phase 2 Authentication Core', () => {
  let authService: AuthService;
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let router: Router;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'home', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('signin sends login identifier and stores returned token and user', () => {
    authService.signin('Bahnasy202222', 'Aa@123456').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/users/signin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      login: 'Bahnasy202222',
      password: 'Aa@123456',
    });
    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush({
      success: true,
      message: 'signed in successfully',
      data: {
        token: 'valid-token-123',
        user: { _id: '1', name: 'Ahmed Bahnasy', username: 'bahnasy202222' },
      },
    });

    expect(authService.getToken()).toBe('valid-token-123');
    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()?.name).toBe('Ahmed Bahnasy');
  });

  it('changePassword updates stored token when a valid refreshed token is returned', () => {
    localStorage.setItem('socialhub_auth_token', 'old-token-123');
    expect(authService.getToken()).toBe('old-token-123');

    authService
      .changePassword({ password: 'OldPassword@1', newPassword: 'NewPassword@1' })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/users/change-password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old-token-123');
    expect(req.request.body).toEqual({
      password: 'OldPassword@1',
      newPassword: 'NewPassword@1',
    });

    req.flush({
      success: true,
      message: 'password changed successfully',
      data: { token: 'refreshed-token-456' },
    });

    expect(authService.getToken()).toBe('refreshed-token-456');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('changePassword keeps existing token and session if response lacks a new token', () => {
    localStorage.setItem('socialhub_auth_token', 'existing-token-123');

    authService
      .changePassword({ password: 'OldPassword@1', newPassword: 'NewPassword@1' })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/users/change-password`);
    req.flush({
      success: true,
      message: 'password changed successfully',
      data: {},
    });

    expect(authService.getToken()).toBe('existing-token-123');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('authInterceptor does not attach token when none exists and preserves existing Authorization headers', () => {
    httpClient.get(`${baseUrl}/posts`).subscribe();
    const unauthReq = httpMock.expectOne(`${baseUrl}/posts`);
    expect(unauthReq.request.headers.has('Authorization')).toBe(false);
    unauthReq.flush({ success: true });

    localStorage.setItem('socialhub_auth_token', 'stored-token-999');
    httpClient
      .get(`${baseUrl}/posts`, {
        headers: { Authorization: 'Bearer custom-header-token' },
      })
      .subscribe();

    const customAuthReq = httpMock.expectOne(`${baseUrl}/posts`);
    expect(customAuthReq.request.headers.get('Authorization')).toBe(
      'Bearer custom-header-token'
    );
    customAuthReq.flush({ success: true });

    const apiCfg = TestBed.inject(API_CONFIG);
    expect(apiCfg.baseUrl).toBe(baseUrl);
  });

  it('authGuard redirects unauthenticated users to /login and allows authenticated users', () => {
    const dummyRoute = {} as ActivatedRouteSnapshot;
    const dummyState = { url: '/profile' } as RouterStateSnapshot;

    const unauthResult = TestBed.runInInjectionContext(() =>
      authGuard(dummyRoute, dummyState)
    );
    expect(unauthResult instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(unauthResult as UrlTree)).toBe('/login');

    localStorage.setItem('socialhub_auth_token', 'active-token-abc');
    const authResult = TestBed.runInInjectionContext(() =>
      authGuard(dummyRoute, dummyState)
    );
    expect(authResult).toBe(true);
  });

  it('signin clears previous user when response has no user and ignores user if token is missing', () => {
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'old-u', name: 'Old User' })
    );

    authService.signin('new@example.com', 'Aa@123456').subscribe();
    const firstReq = httpMock.expectOne(`${baseUrl}/users/signin`);
    firstReq.flush({
      success: true,
      message: 'signed in',
      data: { token: 'new-valid-token' },
    });

    expect(authService.getToken()).toBe('new-valid-token');
    expect(authService.currentUser()).toBeNull();
    expect(localStorage.getItem('socialhub_auth_user')).toBeNull();

    authService.logout(false);
    authService.signin('broken@example.com', 'Aa@123456').subscribe();
    const brokenReq = httpMock.expectOne(`${baseUrl}/users/signin`);
    brokenReq.flush({
      success: true,
      message: 'missing token',
      data: { user: { _id: 'ghost', name: 'Ghost User' } },
    });

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.currentUser()).toBeNull();
    expect(localStorage.getItem('socialhub_auth_user')).toBeNull();
  });

  it('authInterceptor excludes public /users/signin and /users/signup even when a token exists', () => {
    localStorage.setItem('socialhub_auth_token', 'stored-token-123');

    httpClient.post(`${baseUrl}/users/signup`, {}).subscribe();
    const signupReq = httpMock.expectOne(`${baseUrl}/users/signup`);
    expect(signupReq.request.headers.has('Authorization')).toBe(false);
    signupReq.flush({ success: true });

    httpClient.post(`${baseUrl}/users/signin`, {}).subscribe();
    const signinReq = httpMock.expectOne(`${baseUrl}/users/signin`);
    expect(signinReq.request.headers.has('Authorization')).toBe(false);
    signinReq.flush({ success: true });

    httpClient.get(`${baseUrl}/users/profile-data`).subscribe();
    const profileReq = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    expect(profileReq.request.headers.get('Authorization')).toBe('Bearer stored-token-123');
    profileReq.flush({ success: true });
  });
});

describe('Auth Session Persistence, Expiration, Logout & Route Protection', () => {
  const baseUrl = 'https://route-posts.routemisr.com';

  function createJwtWithExp(expSeconds: number): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ user: 'user-1', exp: expSeconds }));
    return `${header}.${payload}.signature`;
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('restores token and currentUser after simulated browser refresh when valid session exists', () => {
    const validToken = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('socialhub_auth_token', validToken);
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'u-1', name: 'Persisted User', username: 'persisted_u' })
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const authService = TestBed.inject(AuthService);
    const httpClient = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.token()).toBe(validToken);
    expect(authService.currentUser()?.name).toBe('Persisted User');

    httpClient.get(`${baseUrl}/users/profile-data`).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${validToken}`);
    req.flush({ success: true });
    httpMock.verify();
  });

  it('clears expired JWT session on startup/refresh and rejects protected routes', () => {
    const expiredToken = createJwtWithExp(Math.floor(Date.now() / 1000) - 120);
    localStorage.setItem('socialhub_auth_token', expiredToken);
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'u-1', name: 'Expired User' })
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'home', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getToken()).toBeNull();
    expect(authService.currentUser()).toBeNull();
    expect(localStorage.getItem('socialhub_auth_token')).toBeNull();
    expect(localStorage.getItem('socialhub_auth_user')).toBeNull();

    const guardResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/home' } as RouterStateSnapshot)
    );
    expect(guardResult instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(guardResult as UrlTree)).toBe('/login');
  });

  it('logout clears signals, clears localStorage, and navigates to /login', () => {
    const validToken = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('socialhub_auth_token', validToken);
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'u-1', name: 'Active User' })
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'home', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(authService.isAuthenticated()).toBe(true);
    authService.logout();

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.token()).toBeNull();
    expect(authService.currentUser()).toBeNull();
    expect(localStorage.getItem('socialhub_auth_token')).toBeNull();
    expect(localStorage.getItem('socialhub_auth_user')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('protects /home, /posts/:postId, /profile, and /change-password in app.routes with authGuard', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const router = TestBed.inject(Router);
    const protectedPaths = ['home', 'posts/:postId', 'profile', 'change-password'] as const;

    for (const routePath of protectedPaths) {
      const routeDef = routes.find((r) => r.path === routePath);
      expect(routeDef?.canActivate?.length).toBeGreaterThan(0);

      const guardFn = routeDef?.canActivate?.[0];
      const result = TestBed.runInInjectionContext(() =>
        (guardFn as typeof authGuard)(
          {} as ActivatedRouteSnapshot,
          { url: `/${routePath}` } as RouterStateSnapshot
        )
      );
      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    }
  });
});

