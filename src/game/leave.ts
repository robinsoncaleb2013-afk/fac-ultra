/* Leaving a game for the main menu (WP-12). Pure: what is going on in, and the plain-English question to ask.
   The store does the saving (engine.ts leaveToMenu); this only decides whether to ask and what to say. */

export type LeaveFacts = {
  /** Where the line is: not cast, cast and waiting, or a fish is on (biting or being reeled in). */
  line: "none" | "waiting" | "fight";
  /** A fishing trip is open (Recreational). */
  trip: boolean;
  /** A tournament event is running. */
  event: boolean;
  /** A Survival run is going. */
  run: boolean;
};

/** One short sentence for each thing that would be interrupted. Empty means nothing is, so there is nothing to ask. */
export function leaveLines(f: LeaveFacts): string[] {
  const out: string[] = [];
  if (f.line === "fight") out.push("A fish is on your line. If you leave now it gets away.");
  else if (f.line === "waiting") out.push("Your line is in the water. It will be pulled in.");
  if (f.event) out.push("Your event keeps counting what you have caught so far, but you will not be able to cast any more until you come back.");
  if (f.trip) out.push("Your trip stays open. Pick Continue to carry on with it.");
  if (f.run) out.push("Your run is paused where it is. Pick Continue to carry on.");
  return out;
}

export const needsLeaveConfirm = (f: LeaveFacts) => leaveLines(f).length > 0;

/** The words on the question, by how serious the interruption is. */
export function leaveTitle(f: LeaveFacts): string {
  if (f.event) return "Leave the event?";
  if (f.trip) return "Leave your trip?";
  if (f.run) return "Leave your run?";
  return "Go back to the main menu?";
}

/** The name of the Leave button for a mode: it says what you are leaving. */
export function leaveLabel(r: { id: string; trips: boolean; survival?: true }): string {
  if (r.id === "tournament") return "Leave event";
  if (r.trips) return "Leave trip";
  if (r.survival) return "Leave run";
  return "Main menu";
}
