import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import {
  AllPostsParams,
  HomeFeedParams,
  PaginationMeta,
  Post,
  PostsListResult,
  SinglePostResult,
} from '../models/post.model';

import {
  asRecord,
  extractPaginationMeta,
  readNonEmptyString,
} from '../utils/api-response.util';

/**
 * Handles Route Posts API operations and normalizes nested response payloads.
 */
@Injectable({
  providedIn: 'root',
})
export class PostsService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiConfig: ApiConfig = inject(API_CONFIG);

  public getAllPosts(params?: AllPostsParams): Observable<PostsListResult> {
    let httpParams = new HttpParams();
    if (params?.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http
      .get<unknown>(`${this.apiConfig.baseUrl}/posts`, { params: httpParams })
      .pipe(
        map((response) => this.normalizePostsListResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public getHomeFeed(params: HomeFeedParams = {}): Observable<PostsListResult> {
    let httpParams = new HttpParams();
    if (params.only !== undefined) {
      httpParams = httpParams.set('only', params.only);
    }
    if (params.hasImage !== undefined) {
      httpParams = httpParams.set('hasImage', String(params.hasImage));
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.cursor !== undefined && params.cursor.trim().length > 0) {
      httpParams = httpParams.set('cursor', params.cursor.trim());
    }

    return this.http
      .get<unknown>(`${this.apiConfig.baseUrl}/posts/feed`, { params: httpParams })
      .pipe(
        map((response) => this.normalizePostsListResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public getPostById(postId: string): Observable<SinglePostResult> {
    const cleanId = postId.trim();
    if (!cleanId) {
      return throwError(() => new Error('A valid post ID is required.'));
    }

    return this.http
      .get<unknown>(`${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanId)}`)
      .pipe(
        map((response) => this.normalizeSinglePostResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public createPost(formData: FormData): Observable<SinglePostResult> {
    return this.http
      .post<unknown>(`${this.apiConfig.baseUrl}/posts`, formData)
      .pipe(
        map((response) => this.normalizeSinglePostResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public updatePost(postId: string, formData: FormData): Observable<SinglePostResult> {
    const cleanId = postId.trim();
    if (!cleanId) {
      return throwError(() => new Error('A valid post ID is required for update.'));
    }

    return this.http
      .put<unknown>(`${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanId)}`, formData)
      .pipe(
        map((response) => this.normalizeSinglePostResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public deletePost(postId: string): Observable<SinglePostResult> {
    const cleanId = postId.trim();
    if (!cleanId) {
      return throwError(() => new Error('A valid post ID is required for deletion.'));
    }

    return this.http
      .delete<unknown>(`${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanId)}`)
      .pipe(
        map((response) => this.normalizeSinglePostResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  private normalizePostsListResponse(raw: unknown): PostsListResult {
    const record = asRecord(raw);
    const message = readNonEmptyString(record?.['message']) ?? 'Posts loaded.';
    const dataRecord = asRecord(record?.['data']);
    const metaRecord = asRecord(record?.['meta']);

    let postsCandidate: unknown = null;
    if (Array.isArray(dataRecord?.['posts'])) {
      postsCandidate = dataRecord['posts'];
    } else if (Array.isArray(record?.['posts'])) {
      postsCandidate = record['posts'];
    } else if (Array.isArray(record?.['data'])) {
      postsCandidate = record['data'];
    }

    const posts = Array.isArray(postsCandidate)
      ? postsCandidate.filter((item): item is Post => this.isPostRecord(item))
      : [];

    const pagination =
      extractPaginationMeta(metaRecord?.['pagination']) ??
      extractPaginationMeta(record?.['pagination']) ??
      extractPaginationMeta(dataRecord?.['pagination']);

    return {
      posts,
      pagination,
      message,
    };
  }

  private normalizeSinglePostResponse(raw: unknown): SinglePostResult {
    const record = asRecord(raw);
    const message = readNonEmptyString(record?.['message']) ?? 'Request completed.';
    const dataRecord = asRecord(record?.['data']);

    let postCandidate: unknown = null;
    if (this.isPostRecord(dataRecord?.['post'])) {
      postCandidate = dataRecord['post'];
    } else if (this.isPostRecord(record?.['post'])) {
      postCandidate = record['post'];
    } else if (this.isPostRecord(record?.['data'])) {
      postCandidate = record['data'];
    } else if (this.isPostRecord(raw)) {
      postCandidate = raw;
    }

    return {
      post: this.isPostRecord(postCandidate) ? postCandidate : null,
      message,
    };
  }

  private isPostRecord(value: unknown): value is Post {
    const record = asRecord(value);
    if (!record) {
      return false;
    }
    const hasId =
      typeof record['_id'] === 'string' || typeof record['id'] === 'string';
    return hasId && typeof record['createdAt'] === 'string';
  }
}
