import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { trimmedRequiredValidator } from '../../../../core/utils/auth-validators.util';
import { PasswordToggleComponent } from '../../../../shared/components/password-toggle/password-toggle.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordToggleComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly infoMessage = signal<string | null>(
    this.readSignupSuccessMessage()
  );

  protected readonly loginForm = this.fb.group({
    identifier: ['', [trimmedRequiredValidator()]],
    password: ['', [Validators.required]],
  });

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected isFieldInvalid(fieldName: keyof typeof this.loginForm.controls): boolean {
    const control = this.loginForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.errorMessages.set([]);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    const { identifier, password } = this.loginForm.getRawValue();

    this.authService
      .signin(identifier, password)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          if (!this.authService.isAuthenticated()) {
            this.errorMessages.set([
              'Sign-in response did not include a valid authentication token.',
            ]);
            return;
          }

          void this.router.navigate(['/home']);
        },
        error: (error: unknown) => {
          this.errorMessages.set(
            extractApiErrorMessages(
              error,
              'Sign-in failed. Please verify your email/username and password.'
            )
          );
        },
      });
  }

  private readSignupSuccessMessage(): string | null {
    const navigation = this.router.getCurrentNavigation();
    const state =
      navigation?.extras.state ??
      (typeof history !== 'undefined' ? (history.state as Record<string, unknown>) : null);
    const message = state?.['signupSuccess'];
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }
}
