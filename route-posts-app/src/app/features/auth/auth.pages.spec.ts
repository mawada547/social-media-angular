import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { ChangePasswordComponent } from './pages/change-password/change-password.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

describe('Authentication Pages', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LoginComponent, SignupComponent, ChangePasswordComponent, NavbarComponent],
      providers: [
        provideRouter([
          { path: 'login', component: LoginComponent },
          { path: 'signup', component: SignupComponent },
          { path: 'home', children: [] },
          { path: 'profile', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('SignupComponent validates inputs and submits exact documented payload', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance as unknown as {
      signupForm: {
        valid: boolean;
        patchValue: (val: Record<string, string>) => void;
        hasError: (err: string) => boolean;
      };
      onSubmit: () => void;
      successMessage: () => string | null;
    };

    fixture.detectChanges();
    component.onSubmit();
    httpMock.expectNone(`${baseUrl}/users/signup`);

    component.signupForm.patchValue({
      name: 'Ahmed Bahnasy',
      username: 'Bahnasy202222',
      email: 'example@gmail.com',
      dateOfBirth: '2000-01-01',
      gender: 'male',
      password: 'Aa@123456',
      rePassword: 'Mismatch@1',
    });
    expect(component.signupForm.hasError('passwordMismatch')).toBe(true);
    component.onSubmit();
    httpMock.expectNone(`${baseUrl}/users/signup`);

    component.signupForm.patchValue({ rePassword: 'Aa@123456' });
    expect(component.signupForm.valid).toBe(true);
    component.onSubmit();

    const req = httpMock.expectOne(`${baseUrl}/users/signup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Ahmed Bahnasy',
      username: 'Bahnasy202222',
      email: 'example@gmail.com',
      dateOfBirth: '2000-01-01',
      gender: 'male',
      password: 'Aa@123456',
      rePassword: 'Aa@123456',
    });

    req.flush({ success: true, message: 'account created', data: { token: 't1' } });
    expect(component.successMessage()).toContain('account created');
  });

  it('LoginComponent validates required fields, stores token, and navigates to /home', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance as unknown as {
      loginForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
    };

    fixture.detectChanges();
    component.onSubmit();
    httpMock.expectNone(`${baseUrl}/users/signin`);

    component.loginForm.patchValue({
      identifier: 'example@gmail.com',
      password: 'Aa@123456',
    });
    component.onSubmit();

    const req = httpMock.expectOne(`${baseUrl}/users/signin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      login: 'example@gmail.com',
      password: 'Aa@123456',
    });

    req.flush({
      success: true,
      message: 'signed in successfully',
      data: {
        token: 'login-token-xyz',
        user: { _id: '10', name: 'Ahmed' },
      },
    });

    const authService = TestBed.inject(AuthService);
    expect(authService.getToken()).toBe('login-token-xyz');
    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });

  it('ChangePasswordComponent sends exact documented body and preserves session', () => {
    localStorage.setItem('socialhub_auth_token', 'current-token');
    const authService = TestBed.inject(AuthService);
    const fixture = TestBed.createComponent(ChangePasswordComponent);
    const component = fixture.componentInstance as unknown as {
      changePasswordForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
      successMessage: () => string | null;
    };

    fixture.detectChanges();
    component.changePasswordForm.patchValue({
      password: 'Aa@123456',
      newPassword: 'Bb@123456',
      confirmNewPassword: 'Bb@123456',
    });
    component.onSubmit();

    const req = httpMock.expectOne(`${baseUrl}/users/change-password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('Authorization')).toBe('Bearer current-token');
    expect(req.request.body).toEqual({
      password: 'Aa@123456',
      newPassword: 'Bb@123456',
    });

    req.flush({
      success: true,
      message: 'password changed successfully',
      data: { token: 'new-token-789' },
    });

    expect(authService.getToken()).toBe('new-token-789');
    expect(authService.isAuthenticated()).toBe(true);
    expect(component.successMessage()).toContain('password changed successfully');
  });

  it('SignupComponent prevents duplicate submissions and renders backend error alerts', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance as unknown as {
      signupForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
    };
    fixture.detectChanges();

    component.signupForm.patchValue({
      name: 'Ahmed Bahnasy',
      username: 'Bahnasy202222',
      email: 'example@gmail.com',
      dateOfBirth: '2000-01-01',
      gender: 'male',
      password: 'Aa@123456',
      rePassword: 'Aa@123456',
    });

    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();

    const submitBtn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Creating Account...');

    const req = httpMock.expectOne(`${baseUrl}/users/signup`);
    req.flush(
      { success: false, message: 'user already exists' },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(submitBtn.disabled).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('user already exists');
  });

  it('LoginComponent prevents duplicate submissions, shows 401 errors, and guards against missing token', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance as unknown as {
      loginForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
    };
    fixture.detectChanges();

    component.loginForm.patchValue({
      identifier: 'Bahnasy202222',
      password: 'WrongPassword@1',
    });

    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();

    const submitBtn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Signing In...');

    const failedReq = httpMock.expectOne(`${baseUrl}/users/signin`);
    expect(failedReq.request.body).toEqual({
      login: 'Bahnasy202222',
      password: 'WrongPassword@1',
    });
    failedReq.flush(
      { success: false, message: 'incorrect email or password' },
      { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(submitBtn.disabled).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'incorrect email or password'
    );
    expect(navigateSpy).not.toHaveBeenCalled();

    // Response missing a token must fail cleanly without navigating
    component.loginForm.patchValue({ password: 'Aa@123456' });
    component.onSubmit();
    const missingTokReq = httpMock.expectOne(`${baseUrl}/users/signin`);
    missingTokReq.flush({ success: true, message: 'ok', data: {} });
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Sign-in response did not include a valid authentication token.'
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('ChangePasswordComponent blocks invalid inputs, prevents duplicate submissions, and preserves session on 401 error', () => {
    localStorage.setItem('socialhub_auth_token', 'active-token');
    const authService = TestBed.inject(AuthService);
    const fixture = TestBed.createComponent(ChangePasswordComponent);
    const component = fixture.componentInstance as unknown as {
      changePasswordForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
    };
    fixture.detectChanges();

    // Weak / mismatched passwords must not trigger API request
    component.changePasswordForm.patchValue({
      password: 'Aa@123456',
      newPassword: 'weak',
      confirmNewPassword: 'different',
    });
    component.onSubmit();
    httpMock.expectNone(`${baseUrl}/users/change-password`);

    component.changePasswordForm.patchValue({
      password: 'WrongCurrent@1',
      newPassword: 'Bb@123456',
      confirmNewPassword: 'Bb@123456',
    });
    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();

    const submitBtn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Updating Password...');

    const req = httpMock.expectOne(`${baseUrl}/users/change-password`);
    req.flush(
      { success: false, message: 'incorrect email or password' },
      { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(submitBtn.disabled).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'incorrect email or password'
    );
    expect(authService.getToken()).toBe('active-token');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('NavbarComponent updates UI on logout, clears AuthService session, and navigates to /login', () => {
    localStorage.setItem('socialhub_auth_token', 'nav-token-123');
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'u-1', name: 'Ahmed Bahnasy' })
    );

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const authService = TestBed.inject(AuthService);
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ahmed Bahnasy');
    expect(el.textContent).toContain('Log Out');

    const logoutBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Log Out'
    );
    logoutBtn?.click();
    fixture.detectChanges();

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getToken()).toBeNull();
    expect(el.textContent).not.toContain('Log Out');
    expect(el.textContent).toContain('Log In');
    expect(el.textContent).toContain('Sign Up');
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});

