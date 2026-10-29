import type { RealtimeEvent } from "#shared/utils/realtime";

// Runs `handler` (typically a useFetch `refresh`) whenever the server says one
// of `events` changed (app/plugins/realtime.client.ts), while the calling
// component is mounted.
export function useRealtime(events: RealtimeEvent[], handler: () => unknown) {
  let stop: (() => void) | undefined;

  onMounted(() => {
    stop = useNuxtApp().$realtime.on((received) => {
      if (events.some((event) => received.has(event))) {
        handler();
      }
    });
  });

  onBeforeUnmount(() => stop?.());
}
