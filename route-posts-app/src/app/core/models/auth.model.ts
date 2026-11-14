import { User } from './user.model';

export type Gender = 'male' | 'female';

export interface SignupRequest {
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly dateOfBirth: string;
  readonly gender: Gender;
  readonly password: string;
  readonly rePassword: string;
}

export type SigninRequest =
  | { readonly email: string; readonly password: string }
  | { readonly username: string; readonly password: string }
  | { readonly login: string; readonly password: string };

export interface ChangePasswordRequest {
  readonly password: string;
  readonly newPassword: string;
}

export interface AuthTokenPayload {
  readonly token?: string;
  readonly tokenType?: string;
  readonly expiresIn?: string;
  readonly user?: User;
}

export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly data?: T;
  readonly errors?: string | readonly string[];
}

export type AuthApiResponse = ApiResponse<AuthTokenPayload>;

