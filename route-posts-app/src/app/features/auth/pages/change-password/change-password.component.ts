import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ChangePasswordRequest } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import {
  passwordMatchValidator,
  STRONG_PASSWORD_PATTERN,
} from '../../../../core/utils/auth-validators.util';
import { PasswordToggleComponent } from '../../../../shared/components/password-toggle/password-toggle.component';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, RouterLink, PasswordToggleComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly showCurrentPassword = signal<boolean>(false);
  protected readonly showNewPassword = signal<boolean>(false);
  protected readonly showConfirmPassword = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly changePasswordForm = this.fb.group(
    {
      password: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD_PATTERN)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    {
      validators: [passwordMatchValidator('newPassword', 'confirmNewPassword')],
    }
  );

  protected isFieldInvalid(
    fieldName: keyof typeof this.changePasswordForm.controls
  ): boolean {
    const control = this.changePasswordForm.controls[fieldName];
    if (fieldName === 'confirmNewPassword' && this.hasPasswordMismatch()) {
      return true;
    }
    return control.invalid && (control.touched || control.dirty);
  }

  protected hasPasswordMismatch(): boolean {
    const confirmControl = this.changePasswordForm.controls.confirmNewPassword;
    return (
      this.changePasswordForm.hasError('passwordMismatch') &&
      (confirmControl.touched || confirmControl.dirty)
    );
  }

  protected onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.errorMessages.set([]);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { password, newPassword } = this.changePasswordForm.getRawValue();
    const payload: ChangePasswordRequest = {
      password,
      newPassword,
    };

    this.authService
      .changePassword(payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.successMessage.set(
            response.message
              ? `${response.message}. Your session remains active.`
              : 'Your password has been updated successfully.'
          );
          this.changePasswordForm.reset({
            password: '',
            newPassword: '',
            confirmNewPassword: '',
          });
          this.showCurrentPassword.set(false);
          this.showNewPassword.set(false);
          this.showConfirmPassword.set(false);
        },
        error: (error: unknown) => {
          this.errorMessages.set(
            extractApiErrorMessages(
              error,
              'Could not update password. Please verify your current password and try again.'
            )
          );
        },
      });
  }
}
