import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { CommentItem, SingleCommentResult } from '../../../../core/models/comment.model';
import { PaginationMeta } from '../../../../core/models/post.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CommentsService } from '../../../../core/services/comments.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { buildCommentFormData, getCommentId } from '../../../../core/utils/comment.util';
import { createPostImageSelector } from '../../../../core/utils/image-selection.util';
import { getUserInitials } from '../../../../core/utils/post.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CommentItemComponent } from '../comment-item/comment-item.component';

@Component({
  selector: 'app-comment-section',
  imports: [ReactiveFormsModule, CommentItemComponent, ConfirmDialogComponent],
  templateUrl: './comment-section.component.html',
  styleUrl: './comment-section.component.css',
})
export class CommentSectionComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly commentsService = inject(CommentsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly createImageInput = viewChild<ElementRef<HTMLInputElement>>('createImageInput');

  public readonly postId = input.required<string>();

  private readonly reloadTrigger$ = new Subject<void>();
  private readonly postId$ = toObservable(this.postId).pipe(
    map((id) => id.trim()),
    distinctUntilChanged()
  );

  protected readonly pageSize = 10;
  protected readonly currentPage = signal<number>(1);
  protected readonly comments = signal<readonly CommentItem[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly actionFeedback = signal<string | null>(null);

  protected readonly createImageSelector = createPostImageSelector(this.destroyRef);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly createValidationError = signal<string | null>(null);
  protected readonly createErrorMessages = signal<readonly string[]>([]);

  protected readonly commentPendingDelete = signal<CommentItem | null>(null);
  protected readonly isDeleting = signal<boolean>(false);
  protected readonly deleteErrorMessage = signal<string | null>(null);
  protected readonly deletingCommentId = computed<string | null>(() => {
    if (!this.isDeleting()) {
      return null;
    }
    const pending = this.commentPendingDelete();
    return pending ? getCommentId(pending) : null;
  });

  protected readonly currentUser = this.authService.currentUser;
  protected readonly userInitials = computed<string>(() =>
    getUserInitials(this.currentUser()?.name)
  );
  protected readonly totalCommentsCount = computed<number>(
    () => this.pagination()?.total ?? this.comments().length
  );

  protected readonly composerForm = this.fb.group({
    content: [''],
  });

  constructor() {
    this.postId$
      .pipe(
        tap(() => {
          this.currentPage.set(1);
          this.comments.set([]);
          this.pagination.set(null);
          this.errorMessages.set([]);
          this.actionFeedback.set(null);
          this.isSubmitting.set(false);
          this.createValidationError.set(null);
          this.createErrorMessages.set([]);
          this.composerForm.reset({ content: '' });
          this.createImageSelector.clear(this.createImageInput()?.nativeElement);
          this.isDeleting.set(false);
          this.commentPendingDelete.set(null);
          this.deleteErrorMessage.set(null);
        }),
        switchMap((cleanId) => {
          if (!cleanId) {
            this.isLoading.set(false);
            return of(null);
          }

          return this.reloadTrigger$.pipe(
            startWith(undefined),
            switchMap(() => {
              this.isLoading.set(true);
              this.errorMessages.set([]);

              return this.commentsService
                .getPostComments(cleanId, this.currentPage(), this.pageSize)
                .pipe(
                  tap((result) => {
                    this.comments.set(result.comments);
                    this.pagination.set(result.pagination);
                  }),
                  catchError((error: unknown) => {
                    this.comments.set([]);
                    this.pagination.set(null);
                    this.errorMessages.set(
                      extractApiErrorMessages(
                        error,
                        'Could not load comments for this post. Please try again.'
                      )
                    );
                    return of(null);
                  }),
                  finalize(() => this.isLoading.set(false))
                );
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected loadComments(): void {
    if (!this.postId().trim()) {
      return;
    }
    this.reloadTrigger$.next();
  }

  protected onContentInput(): void {
    if (this.createValidationError()) {
      this.createValidationError.set(null);
    }
    if (this.createErrorMessages().length > 0) {
      this.createErrorMessages.set([]);
    }
  }

  protected onCreateFileChange(event: Event): void {
    this.createValidationError.set(null);
    this.createErrorMessages.set([]);
    this.actionFeedback.set(null);
    this.createImageSelector.onFileSelected(event);
  }

  protected removeSelectedImage(): void {
    this.createImageSelector.clear(this.createImageInput()?.nativeElement);
  }

  protected submitComment(): void {
    if (this.isSubmitting()) {
      return;
    }

    const cleanPostId = this.postId().trim();
    if (!cleanPostId) {
      this.createErrorMessages.set(['Cannot add a comment without a valid post ID.']);
      return;
    }

    const content = this.composerForm.controls.content.getRawValue();
    const imageFile = this.createImageSelector.selectedFile();
    const imageErr = this.createImageSelector.errorMessage();

    if (imageErr) {
      this.createValidationError.set(imageErr);
      return;
    }

    if (content.trim().length === 0 && imageFile === null) {
      this.createValidationError.set(
        'Please write a comment or attach a valid image before posting.'
      );
      return;
    }

    this.createValidationError.set(null);
    this.createErrorMessages.set([]);
    this.actionFeedback.set(null);
    this.isSubmitting.set(true);

    const formData = buildCommentFormData(content, imageFile);

    this.commentsService
      .createComment(cleanPostId, formData)
      .pipe(
        finalize(() => {
          if (this.postId().trim() === cleanPostId) {
            this.isSubmitting.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          if (this.postId().trim() !== cleanPostId) {
            return;
          }
          this.composerForm.reset({ content: '' });
          this.createImageSelector.clear(this.createImageInput()?.nativeElement);
          this.actionFeedback.set(result.message || 'Comment created successfully.');
          this.currentPage.set(1);
          this.loadComments();
        },
        error: (error: unknown) => {
          if (this.postId().trim() !== cleanPostId) {
            return;
          }
          this.createErrorMessages.set(
            extractApiErrorMessages(error, 'Could not post your comment. Please try again.')
          );
        },
      });
  }

  protected onCommentUpdated(result: SingleCommentResult): void {
    this.actionFeedback.set(result.message || 'Comment updated successfully.');
    this.loadComments();
  }

  protected openDeleteDialog(comment: CommentItem): void {
    this.deleteErrorMessage.set(null);
    this.commentPendingDelete.set(comment);
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting()) {
      return;
    }
    this.commentPendingDelete.set(null);
    this.deleteErrorMessage.set(null);
  }

  protected confirmDeleteComment(): void {
    const cleanPostId = this.postId().trim();
    const target = this.commentPendingDelete();
    const targetCommentId = target ? getCommentId(target).trim() : '';

    if (!cleanPostId || !targetCommentId || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.deleteErrorMessage.set(null);

    this.commentsService
      .deleteComment(cleanPostId, targetCommentId)
      .pipe(
        finalize(() => {
          if (this.postId().trim() === cleanPostId) {
            this.isDeleting.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          if (this.postId().trim() !== cleanPostId) {
            return;
          }
          const remainingCount = this.comments().filter(
            (item) => getCommentId(item) !== targetCommentId
          ).length;
          this.commentPendingDelete.set(null);
          this.actionFeedback.set(result.message || 'Comment deleted successfully.');
          if (remainingCount === 0 && this.currentPage() > 1) {
            this.currentPage.update((page) => Math.max(1, page - 1));
          }
          this.loadComments();
        },
        error: (error: unknown) => {
          if (this.postId().trim() !== cleanPostId) {
            return;
          }
          const messages = extractApiErrorMessages(
            error,
            'Could not delete this comment. Please try again.'
          );
          this.deleteErrorMessage.set(messages[0] ?? 'Could not delete this comment.');
        },
      });
  }

  protected goToPage(page: number): void {
    const meta = this.pagination();
    if (
      page < 1 ||
      (meta && meta.numberOfPages > 0 && page > meta.numberOfPages) ||
      this.isLoading()
    ) {
      return;
    }
    this.actionFeedback.set(null);
    this.currentPage.set(page);
    this.loadComments();
  }

  protected trackComment(comment: CommentItem): string {
    return getCommentId(comment);
  }
}
