import { CommentItem } from '../models/comment.model';
import { User } from '../models/user.model';
import {
  extractOwnerIdFromUserRef,
  extractPopulatedUserRef,
  readNonEmptyString,
} from './api-response.util';
import { buildMediaFormData } from './post.util';

export function getCommentId(comment: CommentItem): string {
  return readNonEmptyString(comment._id) ?? readNonEmptyString(comment.id) ?? '';
}

export function getCommentOwnerId(comment: CommentItem): string | null {
  return extractOwnerIdFromUserRef(comment.commentCreator);
}

export function getCommentAuthor(comment: CommentItem): User | null {
  return extractPopulatedUserRef(comment.commentCreator);
}

export function buildCommentFormData(content: string, imageFile: File | null): FormData {
  return buildMediaFormData('content', content, imageFile);
}

