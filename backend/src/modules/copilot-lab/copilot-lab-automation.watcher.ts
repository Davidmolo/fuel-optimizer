import { runTablet999AutoSend } from "./copilot-lab-automation.service";

/** One named load. OpenRoad allows this kind of single-record check. */
const CHECK_INTERVAL_MS = 10_000;

let timer: ReturnType<typeof setInterval> | undefined;

export function startTablet999AutomationWatcher() {
  if (timer) {
    return;
  }

  const tick = () => {
    void runTablet999AutoSend().catch((error) => {
      console.warn("Tablet 999 automation check failed", error);
    });
  };

  tick();
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopTablet999AutomationWatcher() {
  if (!timer) {
    return;
  }
  clearInterval(timer);
  timer = undefined;
}
