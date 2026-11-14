import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig } from '../config/api.config';
import {
  CommentItem,
  CommentsListResult,
  SingleCommentResult,
} from '../models/comment.model';
import {
  asRecord,
  extractPaginationMeta,
  readNonEmptyString,
} from '../utils/api-response.util';

/**
 * Handles Route Posts API comments CRUD operations and normalizes response payloads.
 */
@Injectable({
  providedIn: 'root',
})
export class CommentsService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiConfig: ApiConfig = inject(API_CONFIG);

  public getPostComments(
    postId: string,
    page = 1,
    limit = 10
  ): Observable<CommentsListResult> {
    const cleanPostId = postId.trim();
    if (!cleanPostId) {
      return throwError(() => new Error('A valid post ID is required to load comments.'));
    }

    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 10;

    const params = new HttpParams()
      .set('page', String(safePage))
      .set('limit', String(safeLimit));

    return this.http
      .get<unknown>(
        `${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanPostId)}/comments`,
        { params }
      )
      .pipe(
        map((response) => this.normalizeCommentsListResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public createComment(
    postId: string,
    formData: FormData
  ): Observable<SingleCommentResult> {
    const cleanPostId = postId.trim();
    if (!cleanPostId) {
      return throwError(() => new Error('A valid post ID is required to create a comment.'));
    }

    return this.http
      .post<unknown>(
        `${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanPostId)}/comments`,
        formData
      )
      .pipe(
        map((response) => this.normalizeSingleCommentResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public updateComment(
    postId: string,
    commentId: string,
    formData: FormData
  ): Observable<SingleCommentResult> {
    const cleanPostId = postId.trim();
    const cleanCommentId = commentId.trim();
    if (!cleanPostId || !cleanCommentId) {
      return throwError(
        () => new Error('Valid post and comment IDs are required to update a comment.')
      );
    }

    return this.http
      .put<unknown>(
        `${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanPostId)}/comments/${encodeURIComponent(cleanCommentId)}`,
        formData
      )
      .pipe(
        map((response) => this.normalizeSingleCommentResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  public deleteComment(
    postId: string,
    commentId: string
  ): Observable<SingleCommentResult> {
    const cleanPostId = postId.trim();
    const cleanCommentId = commentId.trim();
    if (!cleanPostId || !cleanCommentId) {
      return throwError(
        () => new Error('Valid post and comment IDs are required to delete a comment.')
      );
    }

    return this.http
      .delete<unknown>(
        `${this.apiConfig.baseUrl}/posts/${encodeURIComponent(cleanPostId)}/comments/${encodeURIComponent(cleanCommentId)}`
      )
      .pipe(
        map((response) => this.normalizeSingleCommentResponse(response)),
        catchError((error: unknown) => throwError(() => error))
      );
  }

  private normalizeCommentsListResponse(raw: unknown): CommentsListResult {
    const record = asRecord(raw);
    const message = readNonEmptyString(record?.['message']) ?? 'Comments loaded.';
    const dataRecord = asRecord(record?.['data']);
    const metaRecord = asRecord(record?.['meta']);

    let commentsCandidate: unknown = null;
    if (Array.isArray(dataRecord?.['comments'])) {
      commentsCandidate = dataRecord['comments'];
    } else if (Array.isArray(record?.['comments'])) {
      commentsCandidate = record['comments'];
    } else if (Array.isArray(record?.['data'])) {
      commentsCandidate = record['data'];
    }

    const comments = Array.isArray(commentsCandidate)
      ? commentsCandidate.filter((item): item is CommentItem => this.isCommentRecord(item))
      : [];

    const pagination =
      extractPaginationMeta(metaRecord?.['pagination']) ??
      extractPaginationMeta(record?.['pagination']) ??
      extractPaginationMeta(dataRecord?.['pagination']);

    return {
      comments,
      pagination,
      message,
    };
  }

  private normalizeSingleCommentResponse(raw: unknown): SingleCommentResult {
    const record = asRecord(raw);
    const message = readNonEmptyString(record?.['message']) ?? 'Request completed.';
    const dataRecord = asRecord(record?.['data']);

    let commentCandidate: unknown = null;
    if (this.isCommentRecord(dataRecord?.['comment'])) {
      commentCandidate = dataRecord['comment'];
    } else if (this.isCommentRecord(record?.['comment'])) {
      commentCandidate = record['comment'];
    } else if (this.isCommentRecord(record?.['data'])) {
      commentCandidate = record['data'];
    } else if (this.isCommentRecord(raw)) {
      commentCandidate = raw;
    }

    return {
      comment: this.isCommentRecord(commentCandidate) ? commentCandidate : null,
      message,
    };
  }

  private isCommentRecord(value: unknown): value is CommentItem {
    const record = asRecord(value);
    if (!record) {
      return false;
    }
    const hasId =
      typeof record['_id'] === 'string' || typeof record['id'] === 'string';
    return hasId && typeof record['createdAt'] === 'string';
  }
}
