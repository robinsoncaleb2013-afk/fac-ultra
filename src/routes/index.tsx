import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/game/shell";

export const Route = createFileRoute("/")({
  component: Game,
});
