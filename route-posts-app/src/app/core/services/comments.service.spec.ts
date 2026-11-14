import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { buildCommentFormData } from '../utils/comment.util';
import { CommentsService } from './comments.service';

describe('CommentsService (Phase 3B)', () => {
  let service: CommentsService;
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'valid-test-token');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CommentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getPostComments sends Bearer token, pagination query params, and normalizes response', () => {
    let actualTotal: number | undefined;
    let actualCount = 0;

    service.getPostComments('post-123', 2, 5).subscribe((res) => {
      actualCount = res.comments.length;
      actualTotal = res.pagination?.total;
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/post-123/comments` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '5'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer valid-test-token');

    req.flush({
      success: true,
      message: 'success',
      data: {
        comments: [
          {
            _id: 'c-1',
            content: 'Sample comment',
            commentCreator: { _id: 'u-1', name: 'Alice' },
            post: 'post-123',
            createdAt: '2026-11-14T00:00:00.000Z',
          },
        ],
      },
      meta: {
        pagination: { currentPage: 2, numberOfPages: 3, limit: 5, total: 11, prevPage: 1 },
      },
    });

    expect(actualCount).toBe(1);
    expect(actualTotal).toBe(11);
  });

  it('createComment and updateComment submit FormData with content/image and no manual Content-Type header', () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const imageFile = new File([pngBytes], 'photo.png', { type: 'image/png' });
    const createFd = buildCommentFormData('  Hello comment  ', imageFile);

    let createdId: string | undefined;
    service.createComment('post-99', createFd).subscribe((res) => {
      createdId = res.comment?._id;
    });

    const createReq = httpMock.expectOne(`${baseUrl}/posts/post-99/comments`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.get('Authorization')).toBe('Bearer valid-test-token');
    expect(createReq.request.headers.has('Content-Type')).toBe(false);
    expect(createReq.request.body instanceof FormData).toBe(true);
    expect((createReq.request.body as FormData).get('content')).toBe('Hello comment');
    expect((createReq.request.body as FormData).get('image')).toBeTruthy();

    createReq.flush({
      success: true,
      message: 'comment created successfully',
      data: {
        comment: {
          _id: 'comment-created-1',
          content: 'Hello comment',
          commentCreator: { _id: 'u-1', name: 'Alice' },
          post: 'post-99',
          createdAt: '2026-11-14T00:05:00.000Z',
        },
      },
    });
    expect(createdId).toBe('comment-created-1');

    const updateFd = buildCommentFormData('Updated text', null);
    let updatedMessage = '';
    service.updateComment('post-99', 'comment-created-1', updateFd).subscribe((res) => {
      updatedMessage = res.message;
    });

    const updateReq = httpMock.expectOne(`${baseUrl}/posts/post-99/comments/comment-created-1`);
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.headers.get('Authorization')).toBe('Bearer valid-test-token');
    expect(updateReq.request.headers.has('Content-Type')).toBe(false);
    expect((updateReq.request.body as FormData).get('content')).toBe('Updated text');
    expect((updateReq.request.body as FormData).has('image')).toBe(false);

    updateReq.flush({
      success: true,
      message: 'comment updated successfully',
      data: {
        comment: {
          _id: 'comment-created-1',
          content: 'Updated text',
          commentCreator: { _id: 'u-1', name: 'Alice' },
          post: 'post-99',
          createdAt: '2026-11-14T00:05:00.000Z',
        },
      },
    });
    expect(updatedMessage).toBe('comment updated successfully');
  });

  it('deleteComment sends DELETE to the exact postId and commentId path', () => {
    let deleteMessage = '';
    service.deleteComment('post-99', 'comment-7').subscribe((res) => {
      deleteMessage = res.message;
    });

    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/post-99/comments/comment-7`);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.headers.get('Authorization')).toBe('Bearer valid-test-token');
    deleteReq.flush({
      success: true,
      message: 'comment deleted successfully',
      data: {},
    });

    expect(deleteMessage).toBe('comment deleted successfully');
  });

  it('rejects empty postId or commentId before issuing HTTP requests', () => {
    const errors: string[] = [];
    const fd = new FormData();

    service.getPostComments('   ').subscribe({ error: (e: Error) => errors.push(e.message) });
    service.createComment('', fd).subscribe({ error: (e: Error) => errors.push(e.message) });
    service.updateComment('post-1', '  ', fd).subscribe({ error: (e: Error) => errors.push(e.message) });
    service.deleteComment('', 'c-1').subscribe({ error: (e: Error) => errors.push(e.message) });

    httpMock.expectNone(() => true);
    expect(errors.length).toBe(4);
  });
});

