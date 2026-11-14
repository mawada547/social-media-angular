import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import { User, UserProfileResult } from '../models/user.model';
import { asRecord, readNonEmptyString } from '../utils/api-response.util';

/**
 * Handles authenticated user profile retrieval from the Route Posts API.
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiConfig: ApiConfig = inject(API_CONFIG);

  public getProfileData(): Observable<UserProfileResult> {
    return this.http
      .get<unknown>(`${this.apiConfig.baseUrl}/users/profile-data`)
      .pipe(
        map((response) => this.normalizeProfileResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  private normalizeProfileResponse(raw: unknown): UserProfileResult {
    const record = asRecord(raw);
    const message = readNonEmptyString(record?.['message']) ?? 'Profile loaded.';
    const dataRecord = asRecord(record?.['data']);

    let userCandidate: unknown = null;
    if (this.isUserRecord(dataRecord?.['user'])) {
      userCandidate = dataRecord['user'];
    } else if (this.isUserRecord(record?.['user'])) {
      userCandidate = record['user'];
    } else if (this.isUserRecord(record?.['data'])) {
      userCandidate = record['data'];
    } else if (this.isUserRecord(raw)) {
      userCandidate = raw;
    }

    return {
      user: this.isUserRecord(userCandidate) ? userCandidate : null,
      message,
    };
  }

  private isUserRecord(value: unknown): value is User {
    const record = asRecord(value);
    if (!record) {
      return false;
    }

    const hasId =
      typeof record['_id'] === 'string' || typeof record['id'] === 'string';
    return hasId && typeof record['name'] === 'string';
  }
}
