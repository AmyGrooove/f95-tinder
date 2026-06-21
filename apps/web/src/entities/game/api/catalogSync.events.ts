import type { CatalogSyncEvent } from '@f95/contracts';

type CatalogSyncEventHandlers = {
  onEvent: (event: CatalogSyncEvent) => void;
  onOpen: () => void;
  onReconnect: () => void;
};

function parseEvent(message: MessageEvent<string>): CatalogSyncEvent | null {
  try {
    const value = JSON.parse(message.data) as Partial<CatalogSyncEvent>;

    if (
      (value.type === 'snapshot' || value.type === 'progress') &&
      value.data &&
      typeof value.data === 'object'
    ) {
      return value as CatalogSyncEvent;
    }
  } catch {
    return null;
  }

  return null;
}

export function subscribeToCatalogSyncEvents({
  onEvent,
  onOpen,
  onReconnect,
}: CatalogSyncEventHandlers): () => void {
  const eventSource = new EventSource('/api/catalog/sync/events');

  const handleEvent = (message: Event) => {
    const event = parseEvent(message as MessageEvent<string>);

    if (event) {
      onEvent(event);
    }
  };

  eventSource.addEventListener('snapshot', handleEvent);
  eventSource.addEventListener('progress', handleEvent);
  eventSource.addEventListener('open', onOpen);
  eventSource.addEventListener('error', onReconnect);

  return () => {
    eventSource.removeEventListener('snapshot', handleEvent);
    eventSource.removeEventListener('progress', handleEvent);
    eventSource.removeEventListener('open', onOpen);
    eventSource.removeEventListener('error', onReconnect);
    eventSource.close();
  };
}
