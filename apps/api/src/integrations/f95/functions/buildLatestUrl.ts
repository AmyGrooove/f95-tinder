const F95_LATEST_URL =
  'https://f95zone.to/sam/latest_alpha/latest_data.php';

export function buildLatestUrl(page: number): string {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('F95 latest page must be a positive integer');
  }

  const url = new URL(F95_LATEST_URL);
  url.searchParams.set('cmd', 'list');
  url.searchParams.set('cat', 'games');
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort', 'date');

  return url.toString();
}
