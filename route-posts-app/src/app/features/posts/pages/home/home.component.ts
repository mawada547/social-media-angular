import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of, Subject, switchMap, tap } from 'rxjs';
import { PaginationMeta, Post } from '../../../../core/models/post.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PostsService } from '../../../../core/services/posts.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { getPostId, getUserInitials } from '../../../../core/utils/post.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { PostComposerComponent } from '../../components/post-composer/post-composer.component';

type FeedTab = 'following' | 'all' | 'me';

@Component({
  selector: 'app-home',
  imports: [RouterLink, PostComposerComponent, PostCardComponent, ConfirmDialogComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  private readonly postsService = inject(PostsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly loadTrigger$ = new Subject<void>();

  protected readonly activeTab = signal<FeedTab>('following');
  protected readonly imagesOnly = signal<boolean>(false);
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSize = 10;

  protected readonly posts = signal<readonly Post[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly feedErrorMessages = signal<readonly string[]>([]);
  protected readonly actionFeedback = signal<string | null>(null);

  protected readonly postPendingDelete = signal<Post | null>(null);
  protected readonly isDeleting = signal<boolean>(false);
  protected readonly deleteErrorMessage = signal<string | null>(null);
  protected readonly deletingPostId = computed<string | null>(() => {
    if (!this.isDeleting()) {
      return null;
    }
    const target = this.postPendingDelete();
    return target ? getPostId(target) : null;
  });

  protected readonly currentUser = this.authService.currentUser;
  protected readonly userInitials = computed<string>(() =>
    getUserInitials(this.currentUser()?.name)
  );

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          this.feedErrorMessages.set([]);

          const tab = this.activeTab();
          const page = this.currentPage();
          const hasImage = this.imagesOnly() ? true : undefined;

          const request$ =
            tab === 'all' && !hasImage
              ? this.postsService.getAllPosts({ page, limit: this.pageSize })
              : this.postsService.getHomeFeed({
                  only: tab,
                  page,
                  limit: this.pageSize,
                  ...(hasImage !== undefined ? { hasImage } : {}),
                });

          return request$.pipe(
            tap((result) => {
              this.posts.set(result.posts);
              this.pagination.set(result.pagination);
            }),
            catchError((error: unknown) => {
              this.posts.set([]);
              this.pagination.set(null);
              this.feedErrorMessages.set(
                extractApiErrorMessages(
                  error,
                  'Could not load posts from the server. Please try again.'
                )
              );
              return of(null);
            }),
            finalize(() => this.isLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public ngOnInit(): void {
    this.loadFeed();
  }

  protected loadFeed(): void {
    this.loadTrigger$.next();
  }

  protected selectTab(tab: FeedTab): void {
    if (this.activeTab() === tab && !this.isLoading()) {
      return;
    }
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.actionFeedback.set(null);
    this.loadFeed();
  }

  protected toggleImagesOnly(): void {
    this.imagesOnly.update((value) => !value);
    this.currentPage.set(1);
    this.actionFeedback.set(null);
    this.loadFeed();
  }

  protected goToPage(page: number): void {
    const meta = this.pagination();
    if (page < 1 || (meta && page > meta.numberOfPages) || this.isLoading()) {
      return;
    }
    this.currentPage.set(page);
    this.actionFeedback.set(null);
    this.loadFeed();
  }

  protected onPostCreated(createdPost: Post | null = null): void {
    if (createdPost && !createdPost.image && this.imagesOnly()) {
      this.imagesOnly.set(false);
    }
    this.currentPage.set(1);
    this.actionFeedback.set(null);
    this.loadFeed();
  }

  protected onPostUpdated(): void {
    this.actionFeedback.set('Post updated successfully.');
    this.loadFeed();
  }

  protected openDeleteDialog(post: Post): void {
    this.deleteErrorMessage.set(null);
    this.postPendingDelete.set(post);
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting()) {
      return;
    }
    this.postPendingDelete.set(null);
    this.deleteErrorMessage.set(null);
  }

  protected confirmDeletePost(): void {
    const target = this.postPendingDelete();
    const targetId = target ? getPostId(target) : '';
    if (!targetId || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.deleteErrorMessage.set(null);

    this.postsService
      .deletePost(targetId)
      .pipe(
        finalize(() => this.isDeleting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.posts.update((items) => items.filter((item) => getPostId(item) !== targetId));
          this.pagination.update((meta) => {
            if (!meta) {
              return null;
            }
            const nextTotal = Math.max(0, meta.total - 1);
            const nextPages = meta.limit > 0 ? Math.ceil(nextTotal / meta.limit) : meta.numberOfPages;
            return {
              ...meta,
              total: nextTotal,
              numberOfPages: nextPages,
            };
          });
          this.postPendingDelete.set(null);
          this.actionFeedback.set(result.message || 'Post deleted successfully.');

          if (this.posts().length === 0 && this.currentPage() > 1) {
            this.currentPage.update((page) => Math.max(1, page - 1));
            this.loadFeed();
          }
        },
        error: (error: unknown) => {
          const messages = extractApiErrorMessages(
            error,
            'Could not delete this post. Please try again.'
          );
          this.deleteErrorMessage.set(messages[0] ?? 'Could not delete this post.');
        },
      });
  }

  protected trackPost(post: Post): string {
    return getPostId(post);
  }
}
