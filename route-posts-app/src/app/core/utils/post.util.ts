import { Post } from '../models/post.model';
import { User } from '../models/user.model';
import { extractOwnerIdFromUserRef, extractPopulatedUserRef } from './api-response.util';

const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

export function getPostId(post: Post): string {
  return post._id || post.id || '';
}

export function getPostOwnerId(post: Post): string | null {
  return extractOwnerIdFromUserRef(post.user);
}

export function getPostAuthor(post: Post): User | null {
  return extractPopulatedUserRef(post.user);
}

export function getUserInitials(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return 'U';
  }
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function validatePostImageFile(file: File): string | null {
  if (file.size <= 0) {
    return 'Selected image file is empty. Please choose a valid image.';
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return 'Unsupported image format. Please select a JPEG, PNG, WebP, or GIF image.';
  }

  if (file.size > MAX_POST_IMAGE_BYTES) {
    return 'Image size must be 5 MB or smaller.';
  }

  return null;
}

export function buildMediaFormData(
  textField: string,
  textValue: string,
  imageFile: File | null
): FormData {
  const formData = new FormData();
  const trimmedText = textValue.trim();

  if (trimmedText.length > 0) {
    formData.append(textField, trimmedText);
  }

  if (imageFile && imageFile.size > 0) {
    formData.append('image', imageFile, imageFile.name);
  }

  return formData;
}

export function buildPostFormData(body: string, imageFile: File | null): FormData {
  return buildMediaFormData('body', body, imageFile);
}

