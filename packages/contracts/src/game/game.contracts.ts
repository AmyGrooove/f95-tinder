import type { IsoDateTime } from '../common/error.contracts.js';

export interface GameDto {
  id: string;
  f95ThreadId: number;
  threadUrl: string;
  title: string;
  creator: string;
  version: string;
  views: number;
  likes: number;
  rating: number;
  tagIds: number[];
  prefixIds: number[];
  coverUrl: string;
  screenshotUrls: string[];
  publishedAt: IsoDateTime | null;
  sourceUpdatedAt: IsoDateTime;
}

export type UserGameStatus = 'bookmark' | 'trash' | 'played';
