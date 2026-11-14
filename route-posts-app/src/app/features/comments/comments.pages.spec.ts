import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { CommentItem } from '../../core/models/comment.model';
import { buildCommentFormData } from '../../core/utils/comment.util';
import { CommentItemComponent } from './components/comment-item/comment-item.component';
import { CommentSectionComponent } from './components/comment-section/comment-section.component';

function selectTestFile(input: HTMLInputElement, file: File): void {
  const fileList = Object.create(FileList.prototype, {
    0: { value: file, enumerable: true },
    length: { value: 1 },
    item: { value: (index: number) => (index === 0 ? file : null) },
  }) as FileList;
  Object.defineProperty(input, 'files', {
    value: fileList,
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
}

describe('Phase 3B Comments Integration and CRUD', () => {
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';
  const postId = 'post-abc-123';

  const ownedComment: CommentItem = {
    _id: 'comment-own-1',
    content: 'Owner initial comment',
    commentCreator: { _id: 'user-1', name: 'Owner User', username: 'owner_u' },
    post: postId,
    createdAt: '2026-11-14T01:00:00.000Z',
  };

  const otherComment: CommentItem = {
    _id: 'comment-other-2',
    content: 'Other user comment',
    image: 'https://example.com/comment-img.webp',
    commentCreator: { _id: 'user-2', name: 'Other User', username: 'other_u' },
    post: postId,
    createdAt: '2026-11-14T00:50:00.000Z',
  };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'active-token');
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'user-1', name: 'Owner User', username: 'owner_u' })
    );

    await TestBed.configureTestingModule({
      imports: [CommentSectionComponent, CommentItemComponent],
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

  it('loads comments with loading state, renders author/content/image, checks ownership, and paginates', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading comments...');

    const page1Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    expect(page1Req.request.headers.get('Authorization')).toBe('Bearer active-token');

    page1Req.flush({
      success: true,
      message: 'success',
      data: { comments: [ownedComment, otherComment] },
      meta: {
        pagination: { currentPage: 1, limit: 10, total: 12, numberOfPages: 2, nextPage: 2 },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Owner initial comment');
    expect(el.textContent).toContain('Other user comment');
    expect(el.querySelector('img[src="https://example.com/comment-img.webp"]')).toBeTruthy();

    const items = el.querySelectorAll('app-comment-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Edit');
    expect(items[0].textContent).toContain('Delete');
    expect(items[1].textContent).not.toContain('Edit');
    expect(items[1].textContent).not.toContain('Delete');

    // Navigate to page 2
    const nextBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next')
    );
    nextBtn?.click();
    fixture.detectChanges();

    const page2Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10'
    );
    page2Req.flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: {
        pagination: { currentPage: 2, limit: 10, total: 12, numberOfPages: 2, prevPage: 1 },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('No comments yet');
  });

  it('shows error state with retry when loading comments fails', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const failReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`);
    failReq.flush(
      { success: false, message: 'Failed to fetch comments' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Unable to load comments');
    expect(el.textContent).toContain('Failed to fetch comments');

    const retryBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try Again')
    );
    retryBtn?.click();

    const retryReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`);
    retryReq.flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('No comments yet');
  });

  it('prevents empty comment submission and creates comment with FormData then refreshes list', () => {
    const fd = buildCommentFormData('  ', null);
    expect(fd.has('content')).toBe(false);
    expect(fd.has('image')).toBe(false);

    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const form = el.querySelector('form.comment-composer') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    httpMock.expectNone(`${baseUrl}/posts/${postId}/comments`);
    expect(el.textContent).toContain('Please write a comment or attach a valid image');

    const textarea = el.querySelector('textarea.comment-textarea') as HTMLTextAreaElement;
    textarea.value = 'Brand new comment';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const createReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.get('Authorization')).toBe('Bearer active-token');
    expect(createReq.request.headers.has('Content-Type')).toBe(false);
    expect((createReq.request.body as FormData).get('content')).toBe('Brand new comment');

    createReq.flush({
      success: true,
      message: 'comment created successfully',
      data: {
        comment: {
          ...ownedComment,
          _id: 'comment-new-9',
          content: 'Brand new comment',
        },
      },
    });

    // Must refresh comments list after creation
    const refreshReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`);
    refreshReq.flush({
      success: true,
      message: 'success',
      data: {
        comments: [{ ...ownedComment, _id: 'comment-new-9', content: 'Brand new comment' }],
      },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Brand new comment');
    expect(el.textContent).toContain('comment created successfully');
  });

  it('CommentItemComponent edits owned comment via PUT FormData and CommentSectionComponent confirms DELETE', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [ownedComment] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    // 1. Update owned comment
    const editBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Edit'
    );
    editBtn?.click();
    fixture.detectChanges();

    const editTextarea = el.querySelector('textarea.comment-edit-textarea') as HTMLTextAreaElement;
    expect(editTextarea.value).toBe('Owner initial comment');
    editTextarea.value = 'Edited comment text';
    editTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const editForm = el.querySelector('form.comment-edit-form') as HTMLFormElement;
    editForm.dispatchEvent(new Event('submit'));

    const putReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments/${ownedComment._id}`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.headers.get('Authorization')).toBe('Bearer active-token');
    expect((putReq.request.body as FormData).get('content')).toBe('Edited comment text');

    putReq.flush({
      success: true,
      message: 'comment updated successfully',
      data: { comment: { ...ownedComment, content: 'Edited comment text' } },
    });

    // Must refresh comments list after update
    const afterUpdateReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`);
    afterUpdateReq.flush({
      success: true,
      message: 'success',
      data: { comments: [{ ...ownedComment, content: 'Edited comment text' }] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();
    expect(el.textContent).toContain('Edited comment text');

    // 2. Delete owned comment with confirmation dialog
    const deleteBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    deleteBtn?.click();
    fixture.detectChanges();

    httpMock.expectNone(`${baseUrl}/posts/${postId}/comments/${ownedComment._id}`);
    expect(el.textContent).toContain('Delete Comment?');

    const confirmBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Comment'
    );
    confirmBtn?.click();

    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments/${ownedComment._id}`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({
      success: true,
      message: 'comment deleted successfully',
      data: {},
    });

    const refreshAfterDeleteReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    expect(refreshAfterDeleteReq.request.method).toBe('GET');
    refreshAfterDeleteReq.flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: {
        pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Edited comment text');
    expect(el.textContent).toContain('comment deleted successfully');
    expect(el.textContent).toContain('No comments yet');
  });

  it('steps back from page 2 to page 1 and refreshes after deleting the last comment on page 2', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const page1Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    page1Req.flush({
      success: true,
      message: 'success',
      data: { comments: [otherComment] },
      meta: {
        pagination: { currentPage: 1, limit: 10, total: 11, numberOfPages: 2, nextPage: 2 },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const nextBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next')
    );
    nextBtn?.click();
    fixture.detectChanges();

    const page2Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10'
    );
    page2Req.flush({
      success: true,
      message: 'success',
      data: { comments: [ownedComment] },
      meta: {
        pagination: { currentPage: 2, limit: 10, total: 11, numberOfPages: 2, prevPage: 1 },
      },
    });
    fixture.detectChanges();

    const itemDeleteBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('app-comment-item button')
    ).find((b) => b.textContent?.includes('Delete'));
    itemDeleteBtn?.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>(
        '[role="dialog"] button, [aria-modal="true"] button, button'
      )
    ).find(
      (b) =>
        b.textContent?.includes('Delete') &&
        !b.closest('app-comment-item')
    );
    confirmBtn?.click();
    fixture.detectChanges();

    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments/${ownedComment._id}`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({
      success: true,
      message: 'comment deleted successfully',
      data: {},
    });

    const fallbackPage1Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    expect(fallbackPage1Req.request.method).toBe('GET');
    fallbackPage1Req.flush({
      success: true,
      message: 'success',
      data: { comments: [otherComment] },
      meta: {
        pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 },
      },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('comment deleted successfully');
    expect(el.textContent).toContain('Other user comment');
    expect(el.textContent).not.toContain('Owner initial comment');
  });

  it('validates invalid comment image uploads and creates a comment with FormData image attachment', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const initialReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    initialReq.flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector('form input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    selectTestFile(fileInput, new File(['not-an-image'], 'notes.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    const fieldErrorEl = el.querySelector('form .field-error');
    expect(fieldErrorEl?.textContent?.trim().length).toBeGreaterThan(0);

    selectTestFile(fileInput, new File(['pngbytes'], 'reply.png', { type: 'image/png' }));
    fixture.detectChanges();
    expect(el.querySelector('form .field-error')).toBeNull();

    const textarea = el.querySelector('form textarea') as HTMLTextAreaElement;
    textarea.value = 'Comment with image';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const createReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.get('Authorization')).toBe('Bearer active-token');
    expect(createReq.request.headers.has('Content-Type')).toBe(false);
    expect(createReq.request.body instanceof FormData).toBe(true);
    const body = createReq.request.body as FormData;
    expect(body.get('content')).toBe('Comment with image');
    expect((body.get('image') as File).name).toBe('reply.png');

    const createdComment: CommentItem = {
      _id: 'comment-img-99',
      content: 'Comment with image',
      image: 'https://example.com/reply.png',
      commentCreator: { _id: 'user-1', name: 'Owner User', username: 'owner_u' },
      post: postId,
      createdAt: '2026-11-14T02:00:00.000Z',
    };
    createReq.flush({
      success: true,
      message: 'comment created',
      data: { comment: createdComment },
    });

    const refreshReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    refreshReq.flush({
      success: true,
      message: 'success',
      data: { comments: [createdComment] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Comment with image');
    expect(el.querySelector('img[src="https://example.com/reply.png"]')).toBeTruthy();
  });

  it('matches comment ownership via id field and updates comment with FormData replacement image', () => {
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: '', id: 'user-1', name: 'Owner User', username: 'owner_u' })
    );

    const idComment: CommentItem = {
      _id: '',
      id: 'comment-id-1',
      content: 'Comment keyed by id',
      commentCreator: { _id: '', id: 'user-1', name: 'Owner User', username: 'owner_u' },
      post: postId,
      createdAt: '2026-11-14T01:30:00.000Z',
    };

    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const initialReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    initialReq.flush({
      success: true,
      message: 'success',
      data: { comments: [idComment] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const editBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('app-comment-item button')
    ).find((b) => b.textContent?.includes('Edit'));
    expect(editBtn).toBeTruthy();
    editBtn?.click();
    fixture.detectChanges();

    const textarea = el.querySelector('app-comment-item textarea') as HTMLTextAreaElement;
    textarea.value = 'Edited with new photo';
    textarea.dispatchEvent(new Event('input'));

    const fileInput = el.querySelector('app-comment-item input[type="file"]') as HTMLInputElement;
    selectTestFile(fileInput, new File(['webp'], 'edited.webp', { type: 'image/webp' }));
    fixture.detectChanges();

    const form = el.querySelector('app-comment-item form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const putReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments/comment-id-1`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.headers.get('Authorization')).toBe('Bearer active-token');
    expect(putReq.request.headers.has('Content-Type')).toBe(false);
    expect(putReq.request.body instanceof FormData).toBe(true);
    const body = putReq.request.body as FormData;
    expect(body.get('content')).toBe('Edited with new photo');
    expect((body.get('image') as File).name).toBe('edited.webp');

    const returnedComment: CommentItem = {
      ...idComment,
      content: 'Edited with new photo',
      image: 'https://example.com/edited.webp',
    };
    putReq.flush({
      success: true,
      message: 'comment updated successfully',
      data: { comment: returnedComment },
    });

    const refreshReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    refreshReq.flush({
      success: true,
      message: 'success',
      data: { comments: [returnedComment] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Edited with new photo');
    expect(el.textContent).toContain('comment updated successfully');
    expect(el.querySelector('img[src="https://example.com/edited.webp"]')).toBeTruthy();
  });

  it('resets to page 1 when postId changes and renders image-only comments', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    const post1Page1Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    post1Page1Req.flush({
      success: true,
      message: 'success',
      data: { comments: [ownedComment] },
      meta: {
        pagination: { currentPage: 1, limit: 10, total: 12, numberOfPages: 2, nextPage: 2 },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const nextBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next')
    );
    nextBtn?.click();
    fixture.detectChanges();

    const post1Page2Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${postId}/comments` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10'
    );
    post1Page2Req.flush({
      success: true,
      message: 'success',
      data: { comments: [otherComment] },
      meta: {
        pagination: { currentPage: 2, limit: 10, total: 12, numberOfPages: 2, prevPage: 1 },
      },
    });
    fixture.detectChanges();

    const nextPostId = 'post-xyz-999';
    fixture.componentRef.setInput('postId', nextPostId);
    fixture.detectChanges();

    const post2Page1Req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/${nextPostId}/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    expect(post2Page1Req.request.method).toBe('GET');
    post2Page1Req.flush({
      success: true,
      message: 'success',
      data: {
        comments: [
          {
            _id: 'img-only-1',
            content: '',
            image: 'https://example.com/only-pic.jpg',
            commentCreator: otherComment.commentCreator,
            post: nextPostId,
            createdAt: '2026-11-14T03:00:00.000Z',
          },
        ],
      },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Other user comment');
    expect(el.querySelector('img[src="https://example.com/only-pic.jpg"]')).toBeTruthy();
  });

  it('shows backend error alerts on failed create, update, and delete while keeping user state intact', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [ownedComment] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    // 1. Failed create preserves textarea draft and displays error alert
    const composerTextarea = el.querySelector('form.comment-composer textarea') as HTMLTextAreaElement;
    composerTextarea.value = 'Draft that fails';
    composerTextarea.dispatchEvent(new Event('input'));
    const composerForm = el.querySelector('form.comment-composer') as HTMLFormElement;
    composerForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const failCreateReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments`);
    failCreateReq.flush(
      { success: false, message: 'Failed to create comment' },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    expect(el.textContent).toContain('Failed to create comment');
    expect(composerTextarea.value).toBe('Draft that fails');

    // 2. Failed update keeps edit form open and displays error alert
    const editBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('app-comment-item button')).find(
      (b) => b.textContent?.trim() === 'Edit'
    );
    editBtn?.click();
    fixture.detectChanges();

    const editTextarea = el.querySelector('textarea.comment-edit-textarea') as HTMLTextAreaElement;
    editTextarea.value = 'Updated failing text';
    editTextarea.dispatchEvent(new Event('input'));
    const editForm = el.querySelector('form.comment-edit-form') as HTMLFormElement;
    editForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const failPutReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments/${ownedComment._id}`);
    failPutReq.flush(
      { success: false, message: 'You are not allowed to update this comment' },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    expect(el.textContent).toContain('You are not allowed to update this comment');
    expect(el.querySelector('form.comment-edit-form')).toBeTruthy();

    const cancelEditBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('form.comment-edit-form button')
    ).find((b) => b.textContent?.trim() === 'Cancel');
    cancelEditBtn?.click();
    fixture.detectChanges();

    // 3. Failed delete keeps confirmation dialog open and displays error inside dialog
    const deleteBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('app-comment-item button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    deleteBtn?.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Delete Comment'
    );
    confirmBtn?.click();
    fixture.detectChanges();

    const failDeleteReq = httpMock.expectOne(
      `${baseUrl}/posts/${postId}/comments/${ownedComment._id}`
    );
    failDeleteReq.flush(
      { success: false, message: 'you are not allowed to perform this action.' },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    expect(el.textContent).toContain('Delete Comment?');
    expect(el.textContent).toContain('you are not allowed to perform this action.');
  });

  it('ignores stale in-flight comment create completion after postId changes', () => {
    const fixture = TestBed.createComponent(CommentSectionComponent);
    fixture.componentRef.setInput('postId', postId);
    fixture.detectChanges();

    httpMock.expectOne(`${baseUrl}/posts/${postId}/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const composerTextarea = el.querySelector('form.comment-composer textarea') as HTMLTextAreaElement;
    composerTextarea.value = 'Slow comment on first post';
    composerTextarea.dispatchEvent(new Event('input'));
    const composerForm = el.querySelector('form.comment-composer') as HTMLFormElement;
    composerForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const staleCreateReq = httpMock.expectOne(`${baseUrl}/posts/${postId}/comments`);

    const secondPostId = 'post-second-777';
    fixture.componentRef.setInput('postId', secondPostId);
    fixture.detectChanges();

    const secondPostCommentsReq = httpMock.expectOne(
      `${baseUrl}/posts/${secondPostId}/comments?page=1&limit=10`
    );
    secondPostCommentsReq.flush({
      success: true,
      message: 'success',
      data: {
        comments: [
          {
            ...otherComment,
            _id: 'c-second-post',
            post: secondPostId,
            content: 'Comment belonging to second post',
          },
        ],
      },
      meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
    });
    fixture.detectChanges();

    // Complete stale POST for first post; must NOT show feedback or re-fetch under second post
    staleCreateReq.flush({
      success: true,
      message: 'comment created successfully',
      data: { comment: { ...ownedComment, content: 'Slow comment on first post' } },
    });
    fixture.detectChanges();

    httpMock.expectNone(`${baseUrl}/posts/${secondPostId}/comments?page=1&limit=10`);
    expect(el.textContent).not.toContain('comment created successfully');
    expect(el.textContent).toContain('Comment belonging to second post');
  });
});

