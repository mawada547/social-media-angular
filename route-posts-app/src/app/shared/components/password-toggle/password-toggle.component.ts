import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-password-toggle',
  template: `
    <button
      type="button"
      class="password-toggle-btn"
      (click)="toggled.emit()"
      [attr.aria-label]="visible() ? 'Hide ' + label() : 'Show ' + label()"
      [attr.aria-pressed]="visible()"
    >
      @if (visible()) {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      }
    </button>
  `,
})
export class PasswordToggleComponent {
  public readonly visible = input.required<boolean>();
  public readonly label = input<string>('password');
  public readonly toggled = output<void>();
}

