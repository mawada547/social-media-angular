import { PaginationMeta } from '../models/post.model';
import { User } from '../models/user.model';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function extractPaginationMeta(candidate: unknown): PaginationMeta | null {
  const record = asRecord(candidate);
  if (!record) {
    return null;
  }

  const currentPage = readFiniteNumber(record['currentPage']);
  const numberOfPages = readFiniteNumber(record['numberOfPages']);
  const limit = readFiniteNumber(record['limit']);
  const total = readFiniteNumber(record['total']);
  const nextPage = readFiniteNumber(record['nextPage']);
  const prevPage = readFiniteNumber(record['prevPage']);

  if (currentPage === null || numberOfPages === null || limit === null || total === null) {
    return null;
  }

  return {
    currentPage,
    numberOfPages,
    limit,
    total,
    ...(nextPage !== null ? { nextPage } : {}),
    ...(prevPage !== null ? { prevPage } : {}),
  };
}

export function extractOwnerIdFromUserRef(ref: User | string | null | undefined): string | null {
  if (typeof ref === 'string') {
    return readNonEmptyString(ref);
  }

  if (ref && typeof ref === 'object') {
    const id = readNonEmptyString(ref._id) ?? readNonEmptyString((ref as { id?: unknown }).id);
    return id;
  }

  return null;
}

export function extractPopulatedUserRef(ref: User | string | null | undefined): User | null {
  if (ref && typeof ref === 'object' && typeof ref.name === 'string') {
    return ref;
  }
  return null;
}

