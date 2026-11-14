import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of, Subject, switchMap, tap } from 'rxjs';
import { User } from '../../../../core/models/user.model';
import { UserService } from '../../../../core/services/user.service';
import { extractApiErrorMessages } from '../../../../core/utils/api-error.util';
import { readNonEmptyString } from '../../../../core/utils/api-response.util';
import { getUserInitials } from '../../../../core/utils/post.util';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, TitleCasePipe, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly loadTrigger$ = new Subject<void>();

  protected readonly profile = signal<User | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessages = signal<readonly string[]>([]);

  protected readonly userInitials = computed<string>(() =>
    getUserInitials(this.profile()?.name)
  );
  protected readonly photoUrl = computed<string | null>(() =>
    readNonEmptyString(this.profile()?.photo)
  );
  protected readonly coverUrl = computed<string | null>(() =>
    readNonEmptyString(this.profile()?.cover)
  );
  protected readonly userId = computed<string | null>(() => {
    const current = this.profile();
    return current ? readNonEmptyString(current._id) ?? readNonEmptyString(current.id) : null;
  });
  protected readonly followersCount = computed<number>(() => {
    const current = this.profile();
    return current?.followersCount ?? current?.followers?.length ?? 0;
  });
  protected readonly followingCount = computed<number>(() => {
    const current = this.profile();
    return current?.followingCount ?? current?.following?.length ?? 0;
  });
  protected readonly bookmarksCount = computed<number>(() => {
    const current = this.profile();
    return current?.bookmarksCount ?? current?.bookmarks?.length ?? 0;
  });

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          this.errorMessages.set([]);

          return this.userService.getProfileData().pipe(
            tap((result) => {
              this.profile.set(result.user);
            }),
            catchError((error: unknown) => {
              this.profile.set(null);
              this.errorMessages.set(
                extractApiErrorMessages(
                  error,
                  'Could not load your profile details. Please try again.'
                )
              );
              return of(null);
            }),
            finalize(() => this.isLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.loadTrigger$.next();
  }
}
