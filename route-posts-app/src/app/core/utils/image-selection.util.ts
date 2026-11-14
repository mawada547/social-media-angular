import { DestroyRef, Signal, signal } from '@angular/core';
import { validatePostImageFile } from './post.util';

export interface PostImageSelector {
  readonly selectedFile: Signal<File | null>;
  readonly previewUrl: Signal<string | null>;
  readonly errorMessage: Signal<string | null>;
  onFileSelected(event: Event): void;
  clear(inputEl?: HTMLInputElement | null): void;
}

/**
 * Manages optional post image selection, validation, and object-URL lifecycle.
 */
export function createPostImageSelector(destroyRef: DestroyRef): PostImageSelector {
  const selectedFile = signal<File | null>(null);
  const previewUrl = signal<string | null>(null);
  const errorMessage = signal<string | null>(null);

  const revokeCurrentUrl = (): void => {
    const current = previewUrl();
    if (current && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(current);
    }
  };

  destroyRef.onDestroy(() => {
    revokeCurrentUrl();
  });

  const clear = (inputEl?: HTMLInputElement | null): void => {
    revokeCurrentUrl();
    selectedFile.set(null);
    previewUrl.set(null);
    errorMessage.set(null);
    if (inputEl) {
      inputEl.value = '';
    }
  };

  const onFileSelected = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const validationError = validatePostImageFile(file);
    if (validationError) {
      revokeCurrentUrl();
      selectedFile.set(null);
      previewUrl.set(null);
      errorMessage.set(validationError);
      if (input) {
        input.value = '';
      }
      return;
    }

    revokeCurrentUrl();
    errorMessage.set(null);
    selectedFile.set(file);
    if (typeof URL.createObjectURL === 'function') {
      previewUrl.set(URL.createObjectURL(file));
    }
  };

  return {
    selectedFile: selectedFile.asReadonly(),
    previewUrl: previewUrl.asReadonly(),
    errorMessage: errorMessage.asReadonly(),
    onFileSelected,
    clear,
  };
}

