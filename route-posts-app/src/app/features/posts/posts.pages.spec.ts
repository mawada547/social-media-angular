import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { Post } from '../../core/models/post.model';
import { buildPostFormData, validatePostImageFile } from '../../core/utils/post.util';
import { PostCardComponent } from './components/post-card/post-card.component';
import { PostComposerComponent } from './components/post-composer/post-composer.component';
import { HomeComponent } from './pages/home/home.component';
import { PostDetailsComponent } from './pages/post-details/post-details.component';

describe('Phase 3A Posts Integration and CRUD', () => {
  let httpMock: HttpTestingController;
  const baseUrl = 'https://route-posts.routemisr.com';

  const ownerPost: Post = {
    _id: 'post-owner-1',
    body: 'My own post body',
    user: { _id: 'user-1', name: 'Owner User', username: 'owner_u' },
    createdAt: '2026-11-13T12:00:00.000Z',
    commentsCount: 2,
    likesCount: 4,
  };

  const otherPost: Post = {
    _id: 'post-other-2',
    body: 'Someone else post body',
    user: { _id: 'user-2', name: 'Other User', username: 'other_u' },
    createdAt: '2026-11-13T11:00:00.000Z',
    commentsCount: 0,
    likesCount: 1,
  };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('socialhub_auth_token', 'active-token');
    localStorage.setItem(
      'socialhub_auth_user',
      JSON.stringify({ _id: 'user-1', name: 'Owner User', username: 'owner_u' })
    );

    await TestBed.configureTestingModule({
      imports: [HomeComponent, PostDetailsComponent, PostComposerComponent, PostCardComponent],
      providers: [
        provideRouter([
          { path: 'home', component: HomeComponent },
          { path: 'posts/:postId', component: PostDetailsComponent },
        ]),
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

  it('HomeComponent fetches real home feed, renders posts, and shows backend errors without falling back', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const feedReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts/feed` && r.params.get('only') === 'following'
    );
    expect(feedReq.request.headers.get('Authorization')).toBe('Bearer active-token');

    feedReq.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost, otherPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 2 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('My own post body');
    expect(el.textContent).toContain('Someone else post body');
    expect(el.textContent).not.toContain('Phase 1 Layout Preview');

    const postCards = el.querySelectorAll('app-post-card');
    expect(postCards.length).toBe(2);
    expect(postCards[0].textContent).toContain('Edit');
    expect(postCards[0].textContent).toContain('Delete');
    expect(postCards[1].textContent).not.toContain('Edit');
    expect(postCards[1].textContent).not.toContain('Delete');

    // Trigger failure on refresh and confirm error state without fallback to /posts
    const refreshBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Refresh')
    );
    refreshBtn?.click();

    const failReq = httpMock.expectOne((r) => r.url === `${baseUrl}/posts/feed`);
    failReq.flush({ success: false, message: 'Feed service unavailable' }, { status: 500, statusText: 'Server Error' });
    httpMock.expectNone(`${baseUrl}/posts`);
    fixture.detectChanges();

    expect(el.textContent).toContain('Unable to load posts');
    expect(el.textContent).toContain('Feed service unavailable');
  });

  it('HomeComponent shows friendly empty state when API returns no posts', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/posts/feed`);
    req.flush({
      success: true,
      message: 'success',
      data: { posts: [] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 0 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No posts to display');
  });

  it('PostComposerComponent validates content, rejects invalid images, and submits FormData', () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    expect(validatePostImageFile(emptyFile)).toContain('empty');

    const textFile = new File(['abc'], 'notes.txt', { type: 'text/plain' });
    expect(validatePostImageFile(textFile)).toContain('Unsupported image format');

    const fd = buildPostFormData('  Hello world  ', null);
    expect(fd.get('body')).toBe('Hello world');
    expect(fd.get('image')).toBeNull();

    const fixture = TestBed.createComponent(PostComposerComponent);
    const component = fixture.componentInstance as unknown as {
      composerForm: { patchValue: (val: Record<string, string>) => void };
      onSubmit: () => void;
    };
    fixture.detectChanges();

    component.onSubmit();
    httpMock.expectNone(`${baseUrl}/posts`);

    component.composerForm.patchValue({ body: 'Fresh API Post' });
    component.onSubmit();

    const req = httpMock.expectOne(`${baseUrl}/posts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('body')).toBe('Fresh API Post');
    expect((req.request.body as FormData).has('image')).toBe(false);

    req.flush({
      success: true,
      message: 'post created successfully',
      data: {
        post: {
          _id: 'new-1',
          body: 'Fresh API Post',
          user: 'user-1',
          createdAt: '2026-11-13T12:10:00.000Z',
        },
      },
    });
  });

  it('HomeComponent requires confirmation dialog before deleting an owned post', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const feedReq = httpMock.expectOne((r) => r.url === `${baseUrl}/posts/feed`);
    feedReq.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 1 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const deleteBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    deleteBtn?.click();
    fixture.detectChanges();

    // Confirmation dialog opens before any DELETE request is sent
    httpMock.expectNone(`${baseUrl}/posts/${ownerPost._id}`);
    expect(el.textContent).toContain('Delete Post?');

    const confirmBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Post'
    );
    confirmBtn?.click();

    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/${ownerPost._id}`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true, message: 'post deleted successfully' });
    fixture.detectChanges();

    expect(el.textContent).not.toContain('My own post body');
    expect(el.textContent).toContain('post deleted successfully');
  });

  it('PostDetailsComponent reads postId from route params and fetches single post', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/posts/post-detail-42', PostDetailsComponent);

    const req = httpMock.expectOne(`${baseUrl}/posts/post-detail-42`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer active-token');

    req.flush({
      success: true,
      message: 'success',
      data: {
        post: {
          ...ownerPost,
          _id: 'post-detail-42',
          body: 'Detailed post content from API',
        },
      },
    });
    harness.detectChanges();

    const commentsReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/post-detail-42/comments` &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '10'
    );
    expect(commentsReq.request.headers.get('Authorization')).toBe('Bearer active-token');
    commentsReq.flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Detailed post content from API');
    expect(el.textContent).toContain('post-detail-42');
  });

  it('PostCardComponent populates existing body on Edit and submits PUT FormData', () => {
    const fixture = TestBed.createComponent(PostCardComponent);
    fixture.componentRef.setInput('post', ownerPost);
    let updatedEmitted = false;
    fixture.componentInstance.postUpdated.subscribe(() => {
      updatedEmitted = true;
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const editBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Edit'
    );
    editBtn?.click();
    fixture.detectChanges();

    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('My own post body');

    textarea.value = 'Edited post content';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = el.querySelector('form.edit-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    const putReq = httpMock.expectOne(`${baseUrl}/posts/${ownerPost._id}`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body instanceof FormData).toBe(true);
    expect((putReq.request.body as FormData).get('body')).toBe('Edited post content');
    expect(putReq.request.headers.get('Authorization')).toBe('Bearer active-token');

    putReq.flush({
      success: true,
      message: 'post updated successfully',
      data: {
        post: {
          ...ownerPost,
          body: 'Edited post content',
          user: 'user-1',
        },
      },
    });

    expect(updatedEmitted).toBe(true);
  });

  it('HomeComponent supports All Posts, My Posts, image filter, keeps loading state across rapid tab switches, and resets filter on text post creation', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const initialFeedReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts/feed` && r.params.get('only') === 'following'
    );

    // Switch to All Posts BEFORE initial feed finishes: loading indicator must stay active!
    const allPostsTab = Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).find((b) =>
      b.textContent?.includes('All Posts')
    );
    allPostsTab?.click();
    fixture.detectChanges();
    expect(initialFeedReq.cancelled).toBe(true);
    expect(el.textContent).toContain('Loading posts from Route Posts API...');

    const allReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts` && r.params.get('page') === '1' && r.params.get('limit') === '10'
    );
    allReq.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost, otherPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 2, limit: 10, total: 12 } },
    });
    fixture.detectChanges();

    // Verify details link renders real post ID
    const detailsLinks = Array.from(el.querySelectorAll('a')).filter((a) =>
      a.getAttribute('href')?.includes(`/posts/${ownerPost._id}`)
    );
    expect(detailsLinks.length).toBeGreaterThan(0);

    // Toggle "With images only" -> routes to /posts/feed?only=all&hasImage=true
    const imagesCheckbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    imagesCheckbox.click();
    fixture.detectChanges();

    const filteredReq = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/posts/feed` &&
        r.params.get('only') === 'all' &&
        r.params.get('hasImage') === 'true'
    );
    filteredReq.flush({
      success: true,
      message: 'success',
      data: { posts: [] },
      meta: { pagination: { currentPage: 1, numberOfPages: 0, limit: 10, total: 0 } },
    });
    fixture.detectChanges();

    // Creating a text-only post clears imagesOnly filter and refreshes All Posts feed
    const textarea = el.querySelector('app-post-composer textarea') as HTMLTextAreaElement;
    textarea.value = 'Text post while image filter active';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const composerForm = el.querySelector('app-post-composer form') as HTMLFormElement;
    composerForm.dispatchEvent(new Event('submit'));

    const createReq = httpMock.expectOne(`${baseUrl}/posts`);
    createReq.flush({
      success: true,
      message: 'post created successfully',
      data: {
        post: {
          _id: 'created-text-9',
          body: 'Text post while image filter active',
          user: 'user-1',
          createdAt: '2026-11-14T12:00:00.000Z',
        },
      },
    });

    const refreshedAllReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts` && r.params.get('page') === '1'
    );
    refreshedAllReq.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 1 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('My own post body');

    // Switch to My Posts tab
    const myPostsTab = Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).find((b) =>
      b.textContent?.includes('My Posts')
    );
    myPostsTab?.click();
    fixture.detectChanges();

    const meReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts/feed` && r.params.get('only') === 'me'
    );
    meReq.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 1 } },
    });
  });

  it('HomeComponent steps back to previous page when deleting the last post on page 2', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === `${baseUrl}/posts/feed`).flush({
      success: true,
      message: 'success',
      data: { posts: [otherPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 2, limit: 10, total: 11 } },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const nextBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next')
    );
    nextBtn?.click();
    fixture.detectChanges();

    const page2Req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts/feed` && r.params.get('page') === '2'
    );
    page2Req.flush({
      success: true,
      message: 'success',
      data: { posts: [ownerPost] },
      meta: { pagination: { currentPage: 2, numberOfPages: 2, limit: 10, total: 11 } },
    });
    fixture.detectChanges();

    const deleteBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    deleteBtn?.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Post'
    );
    confirmBtn?.click();

    const deleteReq = httpMock.expectOne(`${baseUrl}/posts/${ownerPost._id}`);
    deleteReq.flush({ success: true, message: 'post deleted successfully' });

    const page1Reload = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/posts/feed` && r.params.get('page') === '1'
    );
    page1Reload.flush({
      success: true,
      message: 'success',
      data: { posts: [otherPost] },
      meta: { pagination: { currentPage: 1, numberOfPages: 1, limit: 10, total: 10 } },
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Someone else post body');
  });

  it('PostDetailsComponent handles error/retry, edit reload, postId changes, and delete navigation to /home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/posts/post-err-1', PostDetailsComponent);

    const errReq = httpMock.expectOne(`${baseUrl}/posts/post-err-1`);
    errReq.flush(
      { success: false, message: 'Post Not Found' },
      { status: 404, statusText: 'Not Found' }
    );
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Unable to load post');
    expect(el.textContent).toContain('Post Not Found');

    const tryAgainBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try Again')
    );
    tryAgainBtn?.click();

    httpMock.expectOne(`${baseUrl}/posts/post-err-1`).flush({
      success: true,
      message: 'success',
      data: { post: { ...ownerPost, _id: 'post-err-1', body: 'Recovered post' } },
    });
    harness.detectChanges();
    httpMock.expectOne(`${baseUrl}/posts/post-err-1/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    harness.detectChanges();
    expect(el.textContent).toContain('Recovered post');

    // Edit post inline on PostDetailsComponent -> PUT + reload GET /posts/post-err-1
    const editBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Edit'
    );
    editBtn?.click();
    harness.detectChanges();

    const editTextarea = el.querySelector('form.edit-form textarea') as HTMLTextAreaElement;
    editTextarea.value = 'Recovered post edited';
    editTextarea.dispatchEvent(new Event('input'));
    harness.detectChanges();

    (el.querySelector('form.edit-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    httpMock.expectOne(`${baseUrl}/posts/post-err-1`).flush({
      success: true,
      message: 'post updated successfully',
      data: { post: { ...ownerPost, _id: 'post-err-1', body: 'Recovered post edited', user: 'user-1' } },
    });
    harness.detectChanges();
    expect(el.textContent).toContain('Loading post details...');

    httpMock.expectOne(`${baseUrl}/posts/post-err-1`).flush({
      success: true,
      message: 'success',
      data: { post: { ...ownerPost, _id: 'post-err-1', body: 'Recovered post edited' } },
    });
    harness.detectChanges();
    httpMock.expectOne(`${baseUrl}/posts/post-err-1/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    harness.detectChanges();
    expect(el.textContent).toContain('Post updated successfully.');
    expect(el.textContent).toContain('Recovered post edited');

    // Navigating to a different post clears stale actionFeedback banner
    await harness.navigateByUrl('/posts/post-other-99', PostDetailsComponent);
    httpMock.expectOne(`${baseUrl}/posts/post-other-99`).flush({
      success: true,
      message: 'success',
      data: { post: { ...ownerPost, _id: 'post-other-99', body: 'Second details post' } },
    });
    harness.detectChanges();
    httpMock.expectOne(`${baseUrl}/posts/post-other-99/comments?page=1&limit=10`).flush({
      success: true,
      message: 'success',
      data: { comments: [] },
      meta: { pagination: { currentPage: 1, limit: 10, total: 0, numberOfPages: 0 } },
    });
    harness.detectChanges();
    expect(el.textContent).not.toContain('Post updated successfully.');
    expect(el.textContent).toContain('Second details post');

    // Deleting on PostDetailsComponent navigates to /home
    const deleteBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    );
    deleteBtn?.click();
    harness.detectChanges();

    const confirmBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Post'
    );
    confirmBtn?.click();

    const delReq = httpMock.expectOne(`${baseUrl}/posts/post-other-99`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ success: true, message: 'post deleted successfully' });
    await harness.fixture.whenStable();

    // HomeComponent mounted at /home sends GET /posts/feed
    httpMock.expectOne((r) => r.url === `${baseUrl}/posts/feed`).flush({
      success: true,
      message: 'success',
      data: { posts: [] },
      meta: { pagination: { currentPage: 1, numberOfPages: 0, limit: 10, total: 0 } },
    });
  });
});
