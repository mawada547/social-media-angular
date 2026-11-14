import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;

/**
 * Validates that a text control contains non-whitespace characters.
 */
export function trimmedRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { required: true };
    }
    return null;
  };
}

/**
 * Pure group-level validator confirming that two password fields match.
 */
export function passwordMatchValidator(
  sourceField: string,
  confirmField: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const sourceValue = group.get(sourceField)?.value;
    const confirmValue = group.get(confirmField)?.value;

    if (typeof confirmValue !== 'string' || confirmValue.length === 0) {
      return null;
    }

    return sourceValue === confirmValue ? null : { passwordMismatch: true };
  };
}

/**
 * Validates that a date string (YYYY-MM-DD) is a valid past date.
 */
export function pastDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }

    const parsed = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { invalidDate: true };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsed >= today) {
      return { futureDate: true };
    }

    return null;
  };
}
