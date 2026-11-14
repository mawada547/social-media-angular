import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import {
  AuthApiResponse,
  ChangePasswordRequest,
  SigninRequest,
  SignupRequest,
} from '../models/auth.model';
import { User } from '../models/user.model';

const AUTH_TOKEN_STORAGE_KEY = 'socialhub_auth_token';
const AUTH_USER_STORAGE_KEY = 'socialhub_auth_user';

/**
 * Manages authentication API requests, token persistence, and reactive auth state.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiConfig: ApiConfig = inject(API_CONFIG);
  private readonly router: Router = inject(Router);
  private readonly platformId: object = inject(PLATFORM_ID);

  private readonly tokenSignal = signal<string | null>(this.readValidTokenFromStorage());
  private readonly currentUserSignal = signal<User | null>(
    this.tokenSignal() ? this.readUserFromStorage() : null
  );

  public readonly token = this.tokenSignal.asReadonly();
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly isAuthenticated = computed<boolean>(() => this.tokenSignal() !== null);

  public signup(payload: SignupRequest): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.apiConfig.baseUrl}/users/signup`, payload);
  }

  public signin(identifier: string, password: string): Observable<AuthApiResponse> {
    const payload: SigninRequest = {
      login: identifier.trim(),
      password,
    };

    return this.http
      .post<AuthApiResponse>(`${this.apiConfig.baseUrl}/users/signin`, payload)
      .pipe(
        tap((response) => {
          const token = this.extractValidToken(response);
          if (!token) {
            return;
          }

          this.persistToken(token);

          const user = response.data?.user;
          if (user) {
            this.persistUser(user);
          } else {
            this.currentUserSignal.set(null);
            if (isPlatformBrowser(this.platformId)) {
              localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            }
          }
        })
      );
  }

  public changePassword(payload: ChangePasswordRequest): Observable<AuthApiResponse> {
    const body: ChangePasswordRequest = {
      password: payload.password,
      newPassword: payload.newPassword,
    };

    return this.http
      .patch<AuthApiResponse>(`${this.apiConfig.baseUrl}/users/change-password`, body)
      .pipe(
        tap((response) => {
          const refreshedToken = this.extractValidToken(response);
          if (refreshedToken) {
            this.persistToken(refreshedToken);
          }
        })
      );
  }

  public getToken(): string | null {
    const currentToken = isPlatformBrowser(this.platformId)
      ? this.readValidTokenFromStorage()
      : this.tokenSignal();

    if (!currentToken) {
      if (this.tokenSignal() !== null || this.currentUserSignal() !== null) {
        this.clearSession();
      }
      return null;
    }

    if (this.isTokenExpired(currentToken)) {
      this.clearSession();
      return null;
    }

    if (this.tokenSignal() !== currentToken) {
      this.tokenSignal.set(currentToken);
    }

    if (this.currentUserSignal() === null) {
      const storedUser = this.readUserFromStorage();
      if (storedUser) {
        this.currentUserSignal.set(storedUser);
      }
    }

    return currentToken;
  }

  public logout(redirectToLogin = true): void {
    this.clearSession();
    if (redirectToLogin) {
      void this.router.navigate(['/login']);
    }
  }

  private extractValidToken(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const record = response as Record<string, unknown>;
    const data = record['data'];

    let candidate: unknown = null;
    if (data && typeof data === 'object') {
      candidate = (data as Record<string, unknown>)['token'];
    }
    if (typeof candidate !== 'string' && typeof record['token'] === 'string') {
      candidate = record['token'];
    }

    if (typeof candidate !== 'string') {
      return null;
    }

    const trimmed = candidate.trim();
    if (trimmed.length === 0 || this.isTokenExpired(trimmed)) {
      return null;
    }

    return trimmed;
  }

  private persistToken(token: string): void {
    this.tokenSignal.set(token);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
  }

  private persistUser(user: User): void {
    this.currentUserSignal.set(user);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    }
  }

  private clearSession(): void {
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }

  private readValidTokenFromStorage(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const raw = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const token = raw.trim();
    if (token.length === 0 || this.isTokenExpired(token)) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return null;
    }

    return token;
  }

  private readUserFromStorage(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as User;
      const hasId =
        parsed &&
        (typeof parsed._id === 'string' || typeof parsed.id === 'string');
      return hasId && typeof parsed.name === 'string' ? parsed : null;
    } catch {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as { readonly exp?: unknown };
      if (typeof payload.exp !== 'number') {
        return false;
      }
      return payload.exp * 1000 <= Date.now();
    } catch {
      return false;
    }
  }
}
