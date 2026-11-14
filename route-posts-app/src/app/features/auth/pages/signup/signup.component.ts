import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Gender, SignupRequest } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import {
  passwordMatchValidator,
  pastDateValidator,
  STRONG_PASSWORD_PATTERN,
  trimmedRequiredValidator,
  USERNAME_PATTERN,
} from '../../../../core/utils/auth-validators.util';
import { PasswordToggleComponent } from '../../../../shared/components/password-toggle/password-toggle.component';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, PasswordToggleComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private redirectTimerId: ReturnType<typeof setTimeout> | null = null;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly showRePassword = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly signupForm = this.fb.group(
    {
      name: ['', [trimmedRequiredValidator(), Validators.minLength(2)]],
      username: ['', [trimmedRequiredValidator(), Validators.pattern(USERNAME_PATTERN)]],
      email: ['', [trimmedRequiredValidator(), Validators.email]],
      dateOfBirth: ['', [Validators.required, pastDateValidator()]],
      gender: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD_PATTERN)]],
      rePassword: ['', [Validators.required]],
    },
    {
      validators: [passwordMatchValidator('password', 'rePassword')],
    }
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.redirectTimerId !== null) {
        clearTimeout(this.redirectTimerId);
      }
    });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleRePasswordVisibility(): void {
    this.showRePassword.update((visible) => !visible);
  }

  protected isFieldInvalid(fieldName: keyof typeof this.signupForm.controls): boolean {
    const control = this.signupForm.controls[fieldName];
    if (fieldName === 'rePassword' && this.hasPasswordMismatch()) {
      return true;
    }
    return control.invalid && (control.touched || control.dirty);
  }

  protected hasPasswordMismatch(): boolean {
    const rePassword = this.signupForm.controls.rePassword;
    return (
      this.signupForm.hasError('passwordMismatch') &&
      (rePassword.touched || rePassword.dirty)
    );
  }

  protected onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.errorMessages.set([]);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const raw = this.signupForm.getRawValue();
    const payload: SignupRequest = {
      name: raw.name.trim(),
      username: raw.username.trim(),
      email: raw.email.trim(),
      dateOfBirth: raw.dateOfBirth,
      gender: raw.gender as Gender,
      password: raw.password,
      rePassword: raw.rePassword,
    };

    this.authService
      .signup(payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.successMessage.set(
            response.message
              ? `${response.message}. Redirecting to sign in...`
              : 'Account created successfully! Redirecting to sign in...'
          );
          this.signupForm.reset({
            name: '',
            username: '',
            email: '',
            dateOfBirth: '',
            gender: '',
            password: '',
            rePassword: '',
          });

          this.redirectTimerId = setTimeout(() => {
            void this.router.navigate(['/login'], {
              state: {
                signupSuccess:
                  'Your account has been created successfully. Please sign in to continue.',
              },
            });
          }, 1200);
        },
        error: (error: unknown) => {
          this.errorMessages.set(
            extractApiErrorMessages(
              error,
              'Could not create your account. Please check your information and try again.'
            )
          );
        },
      });
  }
}
