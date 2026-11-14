import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CommentItem, SingleCommentResult } from '../../../../core/models/comment.model';
import { User } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CommentsService } from '../../../../core/services/comments.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { extractOwnerIdFromUserRef } from '../../../../core/utils/api-response.util';
import {
  buildCommentFormData,
  getCommentAuthor,
  getCommentId,
  getCommentOwnerId,
} from '../../../../core/utils/comment.util';
import { createPostImageSelector } from '../../../../core/utils/image-selection.util';
import { getUserInitials } from '../../../../core/utils/post.util';

@Component({
  selector: 'app-comment-item',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './comment-item.component.html',
  styleUrl: './comment-item.component.css',
})
export class CommentItemComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly commentsService = inject(CommentsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly editImageInput = viewChild<ElementRef<HTMLInputElement>>('editImageInput');

  public readonly comment = input.required<CommentItem>();
  public readonly postId = input.required<string>();
  public readonly isDeleting = input<boolean>(false);

  public readonly commentUpdated = output<SingleCommentResult>();
  public readonly deleteRequested = output<CommentItem>();

  protected readonly editImageSelector = createPostImageSelector(this.destroyRef);
  protected readonly isEditing = signal<boolean>(false);
  protected readonly isSavingEdit = signal<boolean>(false);
  protected readonly editValidationError = signal<string | null>(null);
  protected readonly editErrorMessages = signal<readonly string[]>([]);

  protected readonly editForm = this.fb.group({
    content: [''],
  });

  protected readonly commentId = computed<string>(() => getCommentId(this.comment()));
  protected readonly author = computed<User | null>(() => getCommentAuthor(this.comment()));
  protected readonly authorInitials = computed<string>(() =>
    getUserInitials(this.author()?.name)
  );

  protected readonly isOwner = computed<boolean>(() => {
    const currentUserId = extractOwnerIdFromUserRef(this.authService.currentUser());
    const ownerId = getCommentOwnerId(this.comment());
    return currentUserId !== null && ownerId !== null && currentUserId === ownerId;
  });

  protected startEditing(): void {
    if (!this.isOwner() || this.isDeleting()) {
      return;
    }

    this.editForm.setValue({ content: this.comment().content ?? '' });
    this.editImageSelector.clear(this.editImageInput()?.nativeElement);
    this.editValidationError.set(null);
    this.editErrorMessages.set([]);
    this.isEditing.set(true);
  }

  protected cancelEditing(): void {
    if (this.isSavingEdit()) {
      return;
    }
    this.isEditing.set(false);
    this.editImageSelector.clear(this.editImageInput()?.nativeElement);
    this.editValidationError.set(null);
    this.editErrorMessages.set([]);
  }

  protected onEditContentInput(): void {
    if (this.editValidationError()) {
      this.editValidationError.set(null);
    }
    if (this.editErrorMessages().length > 0) {
      this.editErrorMessages.set([]);
    }
  }

  protected onEditFileChange(event: Event): void {
    this.editValidationError.set(null);
    this.editErrorMessages.set([]);
    this.editImageSelector.onFileSelected(event);
  }

  protected clearReplacementImage(): void {
    this.editImageSelector.clear(this.editImageInput()?.nativeElement);
  }

  protected saveEdit(): void {
    if (!this.isOwner() || this.isSavingEdit() || this.isDeleting()) {
      return;
    }

    const content = this.editForm.controls.content.getRawValue();
    const replacementImage = this.editImageSelector.selectedFile();
    const imageErr = this.editImageSelector.errorMessage();

    if (imageErr) {
      this.editValidationError.set(imageErr);
      return;
    }

    if (content.trim().length === 0 && replacementImage === null) {
      this.editValidationError.set('Please enter comment text or choose a replacement image.');
      return;
    }

    const cleanPostId = this.postId().trim();
    const cleanCommentId = this.commentId().trim();
    if (!cleanPostId || !cleanCommentId) {
      this.editErrorMessages.set(['Cannot update this comment because required IDs are missing.']);
      return;
    }

    this.editValidationError.set(null);
    this.editErrorMessages.set([]);
    this.isSavingEdit.set(true);

    const formData = buildCommentFormData(content, replacementImage);

    this.commentsService
      .updateComment(cleanPostId, cleanCommentId, formData)
      .pipe(
        finalize(() => this.isSavingEdit.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.isEditing.set(false);
          this.editImageSelector.clear(this.editImageInput()?.nativeElement);
          this.commentUpdated.emit(result);
        },
        error: (error: unknown) => {
          this.editErrorMessages.set(
            extractApiErrorMessages(error, 'Could not update this comment. Please try again.')
          );
        },
      });
  }

  protected requestDelete(): void {
    if (!this.isOwner() || this.isEditing() || this.isDeleting()) {
      return;
    }
    this.deleteRequested.emit(this.comment());
  }
}

