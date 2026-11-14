import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    title: 'Home Feed | SocialHub',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/posts/pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'posts/:postId',
    title: 'Post Details | SocialHub',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/posts/pages/post-details/post-details.component').then(
        (m) => m.PostDetailsComponent
      ),
  },
  {
    path: 'profile',
    title: 'User Profile | SocialHub',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'change-password',
    title: 'Change Password | SocialHub',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      ),
  },
  {
    path: 'login',
    title: 'Log In | SocialHub',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    title: 'Sign Up | SocialHub',
    loadComponent: () =>
      import('./features/auth/pages/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: '**',
    title: 'Page Not Found | SocialHub',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
