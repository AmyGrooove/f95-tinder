export interface F95LatestThread {
  thread_id: number;
  title: string;
  creator?: unknown;
  version?: unknown;
  views?: unknown;
  likes?: unknown;
  prefixes?: unknown;
  tags?: unknown;
  rating?: unknown;
  cover?: unknown;
  screens?: unknown;
  date?: unknown;
  ts?: unknown;
}

export interface F95LatestResponse {
  status: 'ok';
  msg: {
    data: F95LatestThread[];
    pagination: {
      page: number;
      total: number;
    };
    count: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isF95LatestResponse(value: unknown): value is F95LatestResponse {
  if (!isRecord(value) || value.status !== 'ok' || !isRecord(value.msg)) {
    return false;
  }

  const { data, pagination, count } = value.msg;

  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        isRecord(item) &&
        isPositiveInteger(item.thread_id) &&
        typeof item.title === 'string' &&
        item.title.trim().length > 0,
    ) &&
    isRecord(pagination) &&
    isPositiveInteger(pagination.page) &&
    isNonNegativeInteger(pagination.total) &&
    isNonNegativeInteger(count)
  );
}
