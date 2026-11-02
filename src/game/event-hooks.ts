/* Signals other features can listen to (WP-16 achievements, sounds, the logbook). Plain functions, no store.
   Each `on...` returns an unsubscribe function. A listener that throws never breaks the game. */

import type { EventDef } from "./event-data.ts";

export type MutatedCatch = { event: EventDef; mutation: number; species: number; biome: number; value: number; boss: false };

type Fn<T> = (payload: T) => void;

function bus<T>() {
  const list = new Set<Fn<T>>();
  return {
    on(fn: Fn<T>) {
      list.add(fn);
      return () => void list.delete(fn);
    },
    emit(payload: T) {
      for (const fn of [...list]) {
        try {
          fn(payload);
        } catch {
          /* a broken listener must not stop the game */
        }
      }
    },
  };
}

const started = bus<EventDef>();
const ended = bus<EventDef>();
const mutated = bus<MutatedCatch>();

export const onEventStarted = started.on;
export const onEventEnded = ended.on;
export const onMutatedCatch = mutated.on;
export const emitEventStarted = started.emit;
export const emitEventEnded = ended.emit;
export const emitMutatedCatch = mutated.emit;
