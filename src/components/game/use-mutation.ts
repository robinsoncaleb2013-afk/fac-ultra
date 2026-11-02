import { catchLine, mutationName } from "@/game/events";
import { useKidOn } from "@/components/game/use-kid";

/** Names and effect lines for mutations, in kid-friendly words when Kid Mode is on. */
export function useMutationText() {
  const kid = useKidOn();
  return { name: (m: number) => mutationName(m, kid), line: (m: number) => catchLine(m, kid) };
}
