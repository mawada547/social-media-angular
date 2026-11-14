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
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Post } from '../../../../core/models/post.model';
import { User } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PostsService } from '../../../../core/services/posts.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { extractOwnerIdFromUserRef } from '../../../../core/utils/api-response.util';
import { createPostImageSelector } from '../../../../core/utils/image-selection.util';
import {
  buildPostFormData,
  getPostAuthor,
  getPostId,
  getPostOwnerId,
  getUserInitials,
} from '../../../../core/utils/post.util';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.css',
})
export class PostCardComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly postsService = inject(PostsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly editImageInput = viewChild<ElementRef<HTMLInputElement>>('editImageInput');

  public readonly post = input.required<Post>();
  public readonly showDetailsLink = input<boolean>(true);
  public readonly isDeleting = input<boolean>(false);

  public readonly postUpdated = output<Post | null>();
  public readonly deleteRequested = output<Post>();

  protected readonly editImageSelector = createPostImageSelector(this.destroyRef);
  protected readonly isEditing = signal<boolean>(false);
  protected readonly isSavingEdit = signal<boolean>(false);
  protected readonly editValidationError = signal<string | null>(null);
  protected readonly editErrorMessages = signal<readonly string[]>([]);

  protected readonly editForm = this.fb.group({
    body: [''],
  });

  protected readonly postId = computed<string>(() => getPostId(this.post()));

  protected readonly author = computed<User | null>(() => getPostAuthor(this.post()));

  protected readonly authorInitials = computed<string>(() =>
    getUserInitials(this.author()?.name)
  );

  protected readonly sharedAuthor = computed<User | null>(() => {
    const shared = this.post().sharedPost;
    return shared ? getPostAuthor(shared) : null;
  });

  protected readonly isOwner = computed<boolean>(() => {
    const currentUserId = extractOwnerIdFromUserRef(this.authService.currentUser());
    const ownerId = getPostOwnerId(this.post());
    return currentUserId !== null && ownerId !== null && currentUserId === ownerId;
  });

  protected startEditing(): void {
    if (!this.isOwner() || this.isDeleting()) {
      return;
    }

    this.editForm.setValue({ body: this.post().body ?? '' });
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

  protected onEditBodyInput(): void {
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
    if (!this.isOwner() || this.isSavingEdit()) {
      return;
    }

    const body = this.editForm.controls.body.getRawValue();
    const replacementImage = this.editImageSelector.selectedFile();
    const imageErr = this.editImageSelector.errorMessage();

    if (imageErr) {
      this.editValidationError.set(imageErr);
      return;
    }

    if (body.trim().length === 0 && replacementImage === null) {
      this.editValidationError.set('Please enter post text or choose a replacement image.');
      return;
    }

    const id = this.postId();
    if (!id) {
      this.editErrorMessages.set(['Cannot update this post because its ID is missing.']);
      return;
    }

    this.editValidationError.set(null);
    this.editErrorMessages.set([]);
    this.isSavingEdit.set(true);

    const formData = buildPostFormData(body, replacementImage);

    this.postsService
      .updatePost(id, formData)
      .pipe(
        finalize(() => this.isSavingEdit.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.isEditing.set(false);
          this.editImageSelector.clear(this.editImageInput()?.nativeElement);
          this.postUpdated.emit(result.post);
        },
        error: (error: unknown) => {
          this.editErrorMessages.set(
            extractApiErrorMessages(error, 'Could not update this post. Please try again.')
          );
        },
      });
  }

  protected requestDelete(): void {
    if (!this.isOwner() || this.isEditing() || this.isDeleting()) {
      return;
    }
    this.deleteRequested.emit(this.post());
  }
}

