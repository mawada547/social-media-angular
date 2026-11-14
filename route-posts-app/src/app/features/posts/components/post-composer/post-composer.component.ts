import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { Post } from '../../../../core/models/post.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PostsService } from '../../../../core/services/posts.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { createPostImageSelector } from '../../../../core/utils/image-selection.util';
import { buildPostFormData, getUserInitials } from '../../../../core/utils/post.util';

@Component({
  selector: 'app-post-composer',
  imports: [ReactiveFormsModule],
  templateUrl: './post-composer.component.html',
  styleUrl: './post-composer.component.css',
})
export class PostComposerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly postsService = inject(PostsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly imageInput = viewChild<ElementRef<HTMLInputElement>>('imageInput');

  public readonly postCreated = output<Post | null>();

  protected readonly imageSelector = createPostImageSelector(this.destroyRef);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly validationError = signal<string | null>(null);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly userInitials = computed<string>(() =>
    getUserInitials(this.currentUser()?.name)
  );

  protected readonly composerForm = this.fb.group({
    body: [''],
  });

  protected onFileChange(event: Event): void {
    this.validationError.set(null);
    this.successMessage.set(null);
    this.imageSelector.onFileSelected(event);
  }

  protected removeSelectedImage(): void {
    this.imageSelector.clear(this.imageInput()?.nativeElement);
  }

  protected onBodyInput(): void {
    if (this.validationError()) {
      this.validationError.set(null);
    }
    if (this.successMessage()) {
      this.successMessage.set(null);
    }
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const body = this.composerForm.controls.body.getRawValue();
    const imageFile = this.imageSelector.selectedFile();
    const imageErr = this.imageSelector.errorMessage();

    if (imageErr) {
      this.validationError.set(imageErr);
      return;
    }

    if (body.trim().length === 0 && imageFile === null) {
      this.validationError.set('Please write something or attach a valid image before publishing.');
      return;
    }

    this.validationError.set(null);
    this.errorMessages.set([]);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const formData = buildPostFormData(body, imageFile);

    this.postsService
      .createPost(formData)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.composerForm.reset({ body: '' });
          this.imageSelector.clear(this.imageInput()?.nativeElement);
          this.successMessage.set(result.message || 'Post published successfully.');
          this.postCreated.emit(result.post);
        },
        error: (error: unknown) => {
          this.errorMessages.set(
            extractApiErrorMessages(error, 'Could not publish your post. Please try again.')
          );
        },
      });
  }
}

