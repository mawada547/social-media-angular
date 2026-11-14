import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { buildPostFormData } from '../utils/post.util';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let postsService: PostsService;
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'test-bearer-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    postsService = TestBed.inject(PostsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getHomeFeed attaches Bearer token, sends query params, and maps nested posts + pagination', () => {
    let actualCount = -1;
    let actualTotal = -1;

    postsService
      .getHomeFeed({ only: 'following', limit: 10, page: 2, hasImage: true })
      .subscribe((res) => {
        actualCount = res.posts.length;
        actualTotal = res.pagination?.total ?? 0;
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/feed` &&
        r.params.get('only') === 'following' &&
        r.params.get('limit') === '10' &&
        r.params.get('page') === '2' &&
        r.params.get('hasImage') === 'true'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-bearer-token');

    req.flush({
      success: true,
      message: 'success',
      data: {
        posts: [
          {
            _id: 'p1',
            body: 'Hello feed',
            user: { _id: 'u1', name: 'Sara' },
            createdAt: '2026-11-13T10:00:00.000Z',
          },
        ],
      },
      meta: {
        pagination: { currentPage: 2, numberOfPages: 3, limit: 10, total: 21 },
      },
    });

    expect(actualCount).toBe(1);
    expect(actualTotal).toBe(21);
  });

  it('getAllPosts handles alternative response shapes safely', () => {
    let postsLength = 0;

    postsService.getAllPosts({ page: 1, limit: 5 }).subscribe((res) => {
      postsLength = res.posts.length;
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '5'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-bearer-token');

    req.flush({
      success: true,
      message: 'ok',
      data: [
        {
          _id: 'p2',
          body: 'Alt array shape',
          user: 'u1',
          createdAt: '2026-11-13T10:00:00.000Z',
        },
      ],
    });

    expect(postsLength).toBe(1);
  });

  it('createPost and updatePost send FormData without forcing Content-Type header', () => {
    const createFd = new FormData();
    createFd.append('body', 'New post text');

    postsService.createPost(createFd).subscribe();

    const createReq = httpMock.expectOne(`${baseUrl}/posts`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body instanceof FormData).toBe(true);
    expect(createReq.request.headers.has('Content-Type')).toBe(false);
    expect(createReq.request.headers.get('Authorization')).toBe('Bearer test-bearer-token');
    createReq.flush({
      success: true,
      message: 'post created successfully',
      data: {
        post: {
          _id: 'created-1',
          body: 'New post text',
          user: 'u1',
          createdAt: '2026-11-13T10:00:00.000Z',
        },
      },
    });

    const updateFd = new FormData();
    updateFd.append('body', 'Updated text');

    postsService.updatePost('created-1', updateFd).subscribe();

    const updateReq = httpMock.expectOne(`${baseUrl}/posts/created-1`);
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.body instanceof FormData).toBe(true);
    expect(updateReq.request.headers.has('Content-Type')).toBe(false);
    updateReq.flush({
      success: true,
      message: 'post updated successfully',
      data: {
        post: {
          _id: 'created-1',
          body: 'Updated text',
          user: 'u1',
          createdAt: '2026-11-13T10:00:00.000Z',
        },
      },
    });
  });

  it('getPostById rejects empty IDs and deletePost sends DELETE with Bearer token', () => {
    let errored = false;
    postsService.getPostById('   ').subscribe({
      error: () => {
        errored = true;
      },
    });
    expect(errored).toBe(true);
    httpMock.expectNone(`${baseUrl}/posts/`);

    postsService.deletePost('post-99').subscribe();
    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/post-99`);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.headers.get('Authorization')).toBe('Bearer test-bearer-token');
    deleteReq.flush({ success: true, message: 'post deleted successfully' });
  });

  it('getPostById fetches actual post ID and buildPostFormData includes optional image file cleanly', () => {
    let fetchedBody: string | undefined;
    postsService.getPostById('post-real-77').subscribe((res) => {
      fetchedBody = res.post?.body;
    });

    const getReq = httpMock.expectOne(`${baseUrl}/posts/post-real-77`);
    expect(getReq.request.method).toBe('GET');
    expect(getReq.request.headers.get('Authorization')).toBe('Bearer test-bearer-token');
    getReq.flush({
      success: true,
      message: 'success',
      data: {
        post: {
          _id: 'post-real-77',
          body: 'Single post details payload',
          user: { _id: 'u1', name: 'Sara' },
          createdAt: '2026-11-14T10:00:00.000Z',
        },
      },
    });
    expect(fetchedBody).toBe('Single post details payload');

    const imgFile = new File([new Uint8Array([137, 80, 78, 71])], 'cover.png', { type: 'image/png' });
    const formData = buildPostFormData('With optional image', imgFile);
    postsService.createPost(formData).subscribe();

    const createReq = httpMock.expectOne(`${baseUrl}/posts`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.has('Content-Type')).toBe(false);
    expect((createReq.request.body as FormData).get('body')).toBe('With optional image');
    expect((createReq.request.body as FormData).get('image')).toBeTruthy();
    createReq.flush({ success: true, message: 'post created successfully', data: {} });
  });
});

