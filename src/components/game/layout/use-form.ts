import { useEffect, useState } from "react";
import { formOf, layoutOf, readDevice, type DeviceInfo, type Form, type LayoutPlan } from "@/game/device";

const SERVER: DeviceInfo = { coarse: false, width: 1280, height: 800 };

/** The device class and layout plan; re-evaluated on resize and rotate. `ready` is false until the first browser read. */
export function useForm(): { ready: boolean; form: Form; plan: LayoutPlan; width: number; height: number } {
  const [info, setInfo] = useState<{ d: DeviceInfo; ready: boolean }>({ d: SERVER, ready: false });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setInfo({ d: readDevice(), ready: true }));
    };
    setInfo({ d: readDevice(), ready: true });
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    document.addEventListener("fullscreenchange", read);
    document.addEventListener("webkitfullscreenchange", read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      document.removeEventListener("fullscreenchange", read);
      document.removeEventListener("webkitfullscreenchange", read);
    };
  }, []);
  const form = formOf(info.d);
  return { ready: info.ready, form, plan: layoutOf(form, info.d.width, info.d.height), width: info.d.width, height: info.d.height };
}
