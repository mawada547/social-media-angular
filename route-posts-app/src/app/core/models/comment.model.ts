import { PaginationMeta } from './post.model';
import { User } from './user.model';

export interface CommentItem {
  readonly _id: string;
  readonly id?: string;
  readonly content?: string;
  readonly image?: string;
  readonly commentCreator: User | string;
  readonly post: string;
  readonly parentComment?: string | null;
  readonly likes?: readonly string[];
  readonly likesCount?: number;
  readonly repliesCount?: number;
  readonly isReply?: boolean;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface CommentsListResult {
  readonly comments: readonly CommentItem[];
  readonly pagination: PaginationMeta | null;
  readonly message: string;
}

export interface SingleCommentResult {
  readonly comment: CommentItem | null;
  readonly message: string;
}
