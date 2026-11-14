import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  public readonly open = input<boolean>(false);
  public readonly title = input<string>('Confirm Action');
  public readonly message = input<string>('Are you sure you want to continue?');
  public readonly confirmLabel = input<string>('Confirm');
  public readonly cancelLabel = input<string>('Cancel');
  public readonly isConfirming = input<boolean>(false);
  public readonly errorMessage = input<string | null>(null);

  public readonly confirmed = output<void>();
  public readonly cancelled = output<void>();

  protected onBackdropClick(): void {
    if (!this.isConfirming()) {
      this.cancelled.emit();
    }
  }

  protected onCancel(): void {
    if (!this.isConfirming()) {
      this.cancelled.emit();
    }
  }

  protected onConfirm(): void {
    if (!this.isConfirming()) {
      this.confirmed.emit();
    }
  }
}

