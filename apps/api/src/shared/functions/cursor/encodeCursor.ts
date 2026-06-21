export interface CursorValue {
  updatedAt: string;
  id: string;
}

export function encodeCursor(value: CursorValue): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
