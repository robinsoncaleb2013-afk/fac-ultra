import { useEffect, useState } from "react";

/** Re-render about once a second (countdowns) or as often as `ms`. */
export function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
}
