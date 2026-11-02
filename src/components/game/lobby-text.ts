import { TEAM_MAX } from "@/game/social";

/** Plain-English reasons a join or a new event was refused (kids read this). */
export function joinProblem(error: string, status: number): string {
  switch (error) {
    case "event_over":
      return "That event is over.";
    case "not_started":
      return "It hasn't started yet. Come back a minute before.";
    case "event_full":
      return "That event is full.";
    case "team_full":
      return `That team is full (${TEAM_MAX} anglers). Pick another team.`;
    case "pick_a_team":
      return "Pick a team first.";
    case "banned":
      return "You're sitting out for a while. Come back later.";
    case "too_many_events":
      return "You already have three events running.";
    case "slow_down":
      return "Easy there. Try again in a moment.";
    default:
      return status >= 500 ? "The event board had a hiccup. Try again." : "Couldn't do that. Try again.";
  }
}
