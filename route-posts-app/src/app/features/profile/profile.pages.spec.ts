import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { ProfileComponent } from './pages/profile/profile.component';

describe('ProfileComponent Integration', () => {
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'profile-page-token');

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('shows loading state then displays authenticated user profile fields from /users/profile-data', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading your profile...');

    const req = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer profile-page-token');

    req.flush({
      success: true,
      message: 'success',
      data: {
        user: {
          _id: 'user-prof-1',
          name: 'Nadia Hassan',
          username: 'nadia_h',
          email: 'nadia@example.com',
          dateOfBirth: '1999-03-20T00:00:00.000Z',
          gender: 'female',
          photo: 'https://example.com/nadia.png',
          cover: '',
          followersCount: 15,
          followingCount: 9,
          bookmarksCount: 4,
          createdAt: '2026-11-10T10:00:00.000Z',
        },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Nadia Hassan');
    expect(el.textContent).toContain('@nadia_h');
    expect(el.textContent).toContain('nadia@example.com');
    expect(el.textContent).toContain('Female');
    expect(el.textContent).toContain('15');
    expect(el.textContent).toContain('9');
    expect(el.textContent).toContain('4');
    expect(el.textContent).not.toContain('Phase 1 Placeholder');
    expect(el.textContent).not.toContain('post-preview-101');
    expect(el.querySelector('img[src="https://example.com/nadia.png"]')).toBeTruthy();
  });

  it('displays error state when API fails and recovers on Try Again', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const failReq = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    failReq.flush(
      { success: false, message: 'token expired' },
      { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Unable to load profile');
    expect(el.textContent).toContain('token expired');

    const retryBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try Again')
    );
    retryBtn?.click();

    const retryReq = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    retryReq.flush({
      success: true,
      message: 'success',
      data: {
        user: {
          _id: 'user-prof-1',
          name: 'Nadia Hassan',
        },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Nadia Hassan');
  });

  it('displays friendly empty state when API returns no user record', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    req.flush({
      success: true,
      message: 'success',
      data: {},
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No profile data available');
  });
});

