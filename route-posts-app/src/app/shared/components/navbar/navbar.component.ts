import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly exact: boolean;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);

  protected readonly isMobileMenuOpen = signal<boolean>(false);
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly currentUser = this.authService.currentUser;

  protected readonly userInitials = computed<string>(() => {
    const name = this.currentUser()?.name?.trim();
    if (!name) {
      return 'SH';
    }
    const parts = name.split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  protected readonly mainNavItems: readonly NavItem[] = [
    { label: 'Home', path: '/home', exact: true },
    { label: 'Profile', path: '/profile', exact: false },
    { label: 'Password', path: '/change-password', exact: false },
  ];

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  protected onLogout(): void {
    this.closeMobileMenu();
    this.authService.logout();
  }
}
