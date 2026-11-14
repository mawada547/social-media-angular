import { CommentItem } from './comment.model';
import { User } from './user.model';

export type FeedOnlyFilter = 'following' | 'all' | 'me';

export interface Post {
  readonly _id: string;
  readonly id?: string;
  readonly body?: string;
  readonly image?: string;
  readonly privacy?: string;
  readonly user: User | string;
  readonly sharedPost?: Post | null;
  readonly isShare?: boolean;
  readonly likesCount?: number;
  readonly commentsCount?: number;
  readonly sharesCount?: number;
  readonly bookmarked?: boolean;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly comments?: readonly CommentItem[];
}

export interface PaginationMeta {
  readonly currentPage: number;
  readonly numberOfPages: number;
  readonly limit: number;
  readonly total: number;
  readonly nextPage?: number;
  readonly prevPage?: number;
}

export interface HomeFeedParams {
  readonly only?: FeedOnlyFilter;
  readonly hasImage?: boolean;
  readonly page?: number;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AllPostsParams {
  readonly page?: number;
  readonly limit?: number;
}

export interface PostsListResult {
  readonly posts: readonly Post[];
  readonly pagination: PaginationMeta | null;
  readonly message: string;
}

export interface SinglePostResult {
  readonly post: Post | null;
  readonly message: string;
}
