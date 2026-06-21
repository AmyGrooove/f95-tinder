import type { UpsertGame } from '../../../entities/game/services/game.repository';
import type { F95LatestThread } from '../types/f95LatestResponse';

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numericIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (item): item is number =>
          typeof item === 'number' && Number.isInteger(item) && item > 0,
      ),
    ),
  ];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function parseSourceUpdatedAt(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value < 1_000_000_000_000 ? value * 1_000 : value);
}

export function normalizeF95Game(
  thread: F95LatestThread,
  importedAt = new Date(),
): UpsertGame {
  const publishedAt = parseDate(thread.date);

  return {
    f95ThreadId: thread.thread_id,
    title: thread.title.trim(),
    creator: stringValue(thread.creator),
    version: stringValue(thread.version),
    views: finiteNumber(thread.views),
    likes: finiteNumber(thread.likes),
    rating: finiteNumber(thread.rating),
    tagIds: numericIds(thread.tags),
    prefixIds: numericIds(thread.prefixes),
    coverUrl: stringValue(thread.cover),
    screenshotUrls: stringList(thread.screens),
    publishedAt,
    sourceUpdatedAt:
      parseSourceUpdatedAt(thread.ts) ?? publishedAt ?? importedAt,
    importedAt,
  };
}
