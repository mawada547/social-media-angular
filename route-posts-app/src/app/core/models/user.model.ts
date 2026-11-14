import { Gender } from './auth.model';

export interface User {
  readonly _id: string;
  readonly id?: string;
  readonly name: string;
  readonly username?: string;
  readonly email?: string;
  readonly dateOfBirth?: string;
  readonly gender?: Gender | string;
  readonly photo?: string;
  readonly cover?: string;
  readonly bookmarks?: readonly unknown[];
  readonly followers?: readonly unknown[];
  readonly following?: readonly unknown[];
  readonly followersCount?: number;
  readonly followingCount?: number;
  readonly bookmarksCount?: number;
  readonly createdAt?: string;
}

export interface UserProfileResult {
  readonly user: User | null;
  readonly message: string;
}
