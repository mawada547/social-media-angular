import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, finalize, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { Post } from '../../../../core/models/post.model';
import { PostsService } from '../../../../core/services/posts.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { getPostId } from '../../../../core/utils/post.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CommentSectionComponent } from '../../../comments/components/comment-section/comment-section.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';

@Component({
  selector: 'app-post-details',
  imports: [RouterLink, PostCardComponent, CommentSectionComponent, ConfirmDialogComponent],
  templateUrl: './post-details.component.html',
  styleUrl: './post-details.component.css',
})
export class PostDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postsService = inject(PostsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly reloadTrigger$ = new Subject<void>();

  protected readonly currentPostId = signal<string>('');
  protected readonly post = signal<Post | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly actionFeedback = signal<string | null>(null);

  protected readonly showDeleteDialog = signal<boolean>(false);
  protected readonly isDeleting = signal<boolean>(false);
  protected readonly deleteErrorMessage = signal<string | null>(null);

  protected readonly resolvedPostId = computed<string>(() => {
    const loaded = this.post();
    return loaded ? getPostId(loaded) : this.currentPostId();
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('postId')?.trim() ?? ''),
        distinctUntilChanged(),
        tap((postId) => {
          this.currentPostId.set(postId);
          this.actionFeedback.set(null);
          this.showDeleteDialog.set(false);
          this.deleteErrorMessage.set(null);
        }),
        switchMap((postId) =>
          this.reloadTrigger$.pipe(
            startWith(undefined),
            switchMap(() => {
              this.errorMessages.set([]);
              this.post.set(null);

              if (!postId) {
                this.isLoading.set(false);
                this.errorMessages.set(['No post ID was provided in the URL.']);
                return of(null);
              }

              this.isLoading.set(true);

              return this.postsService.getPostById(postId).pipe(
                tap((result) => {
                  this.post.set(result.post);
                }),
                catchError((error: unknown) => {
                  this.post.set(null);
                  this.errorMessages.set(
                    extractApiErrorMessages(error, 'Could not load this post.')
                  );
                  return of(null);
                }),
                finalize(() => this.isLoading.set(false))
              );
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected reloadPost(): void {
    this.reloadTrigger$.next();
  }

  protected onPostUpdated(): void {
    this.actionFeedback.set('Post updated successfully.');
    this.reloadPost();
  }

  protected openDeleteDialog(): void {
    if (!this.post() || this.isDeleting()) {
      return;
    }
    this.deleteErrorMessage.set(null);
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting()) {
      return;
    }
    this.showDeleteDialog.set(false);
    this.deleteErrorMessage.set(null);
  }

  protected confirmDeletePost(): void {
    const current = this.post();
    const targetId = current ? getPostId(current) : '';
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
        next: () => {
          this.showDeleteDialog.set(false);
          void this.router.navigate(['/home']);
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
}
