import { Volume2 } from "lucide-react";
import { canSpeak, speak } from "@/components/game/use-kid";
import { cn } from "@/lib/cn";

/** The 🔊 button Kid Mode puts next to long messages. */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      aria-label="Read this out loud"
      title="Read this out loud"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={cn(
        "pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-brass",
        className,
      )}
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}
