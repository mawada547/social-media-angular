import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'profile-test-token');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getProfileData calls /users/profile-data with Bearer token and maps user fields', () => {
    let returnedEmail: string | undefined;
    let followersCount: number | undefined;
    let statusMessage = '';

    service.getProfileData().subscribe((result) => {
      returnedEmail = result.user?.email;
      followersCount = result.user?.followersCount;
      statusMessage = result.message;
    });

    const req = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer profile-test-token');

    req.flush({
      success: true,
      message: 'success',
      data: {
        user: {
          _id: '6af84074fbc846000b3f616a',
          name: 'Profile Inspector',
          username: 'prof_insp',
          email: 'prof_insp@example.com',
          dateOfBirth: '1998-05-15T00:00:00.000Z',
          gender: 'female',
          photo: 'https://example.com/avatar.png',
          cover: '',
          followersCount: 12,
          followingCount: 7,
          bookmarksCount: 3,
          createdAt: '2026-11-14T11:05:24.855Z',
        },
      },
    });

    expect(returnedEmail).toBe('prof_insp@example.com');
    expect(followersCount).toBe(12);
    expect(statusMessage).toBe('success');
  });

  it('getProfileData returns null user cleanly when API data has no user record', () => {
    let userValue: unknown = 'initial';

    service.getProfileData().subscribe((result) => {
      userValue = result.user;
    });

    const req = httpMock.expectOne(`${baseUrl}/users/profile-data`);
    req.flush({
      success: true,
      message: 'empty',
      data: {},
    });

    expect(userValue).toBeNull();
  });
});

