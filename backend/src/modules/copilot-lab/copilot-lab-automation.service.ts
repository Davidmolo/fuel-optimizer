import {
  findOpenRoadExtLoadByCustomerLoad,
  getOpenRoadExtLoad,
  isOpenRoadExtConfigured,
  OPENROAD_EXT_ACTIVE_LOAD_STATUSES,
} from "../../integrations/openroad";
import { isFuelOptimizerTmsTripId, isTripManagementConfigured, searchTripsByDriverId } from "../../integrations/trip-management";
import { HttpError } from "../../utils/http-error";
import { TmsLoadModel } from "../tms/models/tms-load.model";
import { upsertSingleOpenRoadLoad } from "../tms/services/tms-sync.service";
import { dispatchTrimbleTripWithFuelStopForLoad } from "../tms/services/trimble-trip.service";
import {
  COPILOT_LAB_AUTOMATION_KEY,
  CopilotLabAutomationModel,
  type CopilotLabAutomationDocument,
  type CopilotLabAutomationStatus,
} from "./models/copilot-lab-automation.model";
import {
  LAB_TABLET_ID,
  assertLabTablet,
  countGeocodedLoadStops,
  decideTablet999AutoSend,
  isLabTmsTripId,
  pickTabletTrip,
  toLabTripView,
} from "./copilot-lab.rules";

const OFF_MESSAGE = "Off. Tablet 999 will not receive a load.";
const SEND_CLAIM_STALE_MS = 90_000;

let autoSendInFlight: Promise<CopilotLabAutomationView> | null = null;

function watchingMessage(watchedLoad: string) {
  return `On. Checking OpenRoad for load ${watchedLoad}. It is sent to tablet 999 within a few seconds of being assigned. Other loads are left alone.`;
}

export type CopilotLabAutomationView = {
  enabled: boolean;
  tabletId: typeof LAB_TABLET_ID;
  watchedLoad: string | null;
  lastStatus: CopilotLabAutomationStatus;
  lastMessage: string;
  lastOpenroadLoadId: number | null;
  lastRunAt: string | null;
  enabledAt: string | null;
};

function toView(document: CopilotLabAutomationDocument): CopilotLabAutomationView {
  return {
    enabled: document.enabled,
    tabletId: LAB_TABLET_ID,
    watchedLoad: document.watchedLoad ?? null,
    lastStatus: document.lastStatus,
    lastMessage: document.lastMessage,
    lastOpenroadLoadId: document.lastOpenroadLoadId ?? null,
    lastRunAt: document.lastRunAt ? document.lastRunAt.toISOString() : null,
    enabledAt: document.enabledAt ? document.enabledAt.toISOString() : null,
  };
}

async function getSettings() {
  const document = await CopilotLabAutomationModel.findOneAndUpdate(
    { key: COPILOT_LAB_AUTOMATION_KEY },
    {
      $setOnInsert: {
        key: COPILOT_LAB_AUTOMATION_KEY,
        enabled: false,
        watchedLoad: null,
        lastStatus: "off",
        lastMessage: OFF_MESSAGE,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!document) {
    throw new HttpError("Could not read the tablet 999 automation switch.", 500);
  }

  return document;
}

async function writeSettings(patch: Partial<CopilotLabAutomationDocument>) {
  const updated = await CopilotLabAutomationModel.findOneAndUpdate(
    { key: COPILOT_LAB_AUTOMATION_KEY },
    { $set: patch },
    { new: true },
  );
  if (!updated) {
    throw new HttpError("Could not save the tablet 999 automation switch.", 500);
  }
  return updated;
}

function loadLabel(loadNumber: string, openroadLoadId: number | null) {
  if (loadNumber && String(openroadLoadId ?? "") !== loadNumber) {
    return `${loadNumber} (OpenRoad ${openroadLoadId ?? "load"})`;
  }
  return loadNumber || String(openroadLoadId ?? "the load");
}

function messageFor(input: {
  status: CopilotLabAutomationStatus;
  watchedLoad: string;
  openroadLoadId: number | null;
  detail?: string;
  fuelStopCount?: number;
}) {
  const label = loadLabel(input.watchedLoad, input.openroadLoadId);

  switch (input.status) {
    case "off":
      return OFF_MESSAGE;
    case "waiting":
      return input.detail ?? watchingMessage(input.watchedLoad);
    case "busy":
      return `On. Load ${label} is waiting because tablet 999 already has a trip. ${input.detail ?? "Clear that trip, then the next check will send this load."}`;
    case "not-ready":
      return `On. Load ${label} is in Fuel Optimizer but does not have two mapped stops yet.`;
    case "already-on-lab":
      return `Load ${label} is already on tablet 999. Accept it in OpenRoad, skip Open in Copilot, then open CoPilot.`;
    case "blocked-fleet":
      return `Load ${label} is already on a driver tablet. It was not sent to tablet 999.`;
    case "blocked-other-system":
      return `Load ${label} is linked to a trip Fuel Optimizer does not own. It was not sent to tablet 999.`;
    case "sent": {
      const fuel =
        input.fuelStopCount && input.fuelStopCount > 0
          ? ` with ${input.fuelStopCount} fuel ${input.fuelStopCount === 1 ? "stop" : "stops"}`
          : "";
      return `Sent load ${label} to tablet 999${fuel}. Accept it in OpenRoad, skip Open in Copilot, then open CoPilot and accept the new trip.`;
    }
    case "error":
      return input.detail?.trim() || `Could not send load ${label} to tablet 999.`;
    default:
      return OFF_MESSAGE;
  }
}

export async function getTablet999Automation(): Promise<CopilotLabAutomationView> {
  return toView(await getSettings());
}

export async function setTablet999Automation(input: {
  enabled: boolean;
  watchedLoad?: string | null;
}): Promise<CopilotLabAutomationView> {
  const current = await getSettings();

  if (!input.enabled) {
    return toView(
      await writeSettings({
        enabled: false,
        lastStatus: "off",
        lastMessage: OFF_MESSAGE,
      }),
    );
  }

  const watchedLoad = (input.watchedLoad ?? current.watchedLoad ?? "").trim();
  if (!watchedLoad) {
    throw new HttpError("Enter the OpenRoad load number to watch before turning automation on.", 400);
  }

  assertLabTablet(LAB_TABLET_ID);
  const saved = await writeSettings({
    enabled: true,
    watchedLoad,
    enabledAt: new Date(),
    lastStatus: "waiting",
    lastOpenroadLoadId: null,
    lastMessage: watchingMessage(watchedLoad),
    sending: false,
  });
  void runTablet999AutoSend().catch((error) => {
    console.warn("Tablet 999 automation check failed", error);
  });
  return toView(saved);
}

async function saveStatus(
  document: CopilotLabAutomationDocument,
  input: {
    status: CopilotLabAutomationStatus;
    openroadLoadId?: number | null;
    detail?: string;
    fuelStopCount?: number;
  },
) {
  const watchedLoad = document.watchedLoad?.trim() || "";
  const lastOpenroadLoadId = input.openroadLoadId ?? document.lastOpenroadLoadId ?? null;
  const updated = await writeSettings({
    lastRunAt: new Date(),
    lastStatus: input.status,
    lastOpenroadLoadId,
    lastMessage: messageFor({
      status: input.status,
      watchedLoad,
      openroadLoadId: lastOpenroadLoadId,
      detail: input.detail,
      fuelStopCount: input.fuelStopCount,
    }),
  });
  return toView(updated);
}

const ACTIVE_OPENROAD_STATUSES = new Set<string>(OPENROAD_EXT_ACTIVE_LOAD_STATUSES);

async function pullWatchedLoad(watchedLoad: string) {
  if (!isOpenRoadExtConfigured()) {
    return { state: "skipped" as const };
  }

  const trimmed = watchedLoad.trim();
  const numeric = Number(trimmed);
  let remote = null;
  if (Number.isInteger(numeric) && numeric > 0) {
    remote = await getOpenRoadExtLoad(numeric);
  }
  if (!remote) {
    remote = await findOpenRoadExtLoadByCustomerLoad(trimmed);
  }
  if (!remote) {
    return { state: "missing" as const };
  }
  if (!ACTIVE_OPENROAD_STATUSES.has(remote.status)) {
    return { state: "not-active" as const, status: remote.status };
  }

  const stored = await upsertSingleOpenRoadLoad(remote);
  if (!stored.stored) {
    return { state: "not-active" as const, status: remote.status };
  }
  return { state: "stored" as const };
}

async function claimTablet999Send() {
  const staleBefore = new Date(Date.now() - SEND_CLAIM_STALE_MS);
  const claimed = await CopilotLabAutomationModel.findOneAndUpdate(
    {
      key: COPILOT_LAB_AUTOMATION_KEY,
      enabled: true,
      $or: [{ sending: { $ne: true } }, { sendingStartedAt: { $lt: staleBefore } }, { sendingStartedAt: null }],
    },
    { $set: { sending: true, sendingStartedAt: new Date() } },
    { new: true },
  );
  return Boolean(claimed);
}

async function releaseTablet999Send() {
  await CopilotLabAutomationModel.updateOne(
    { key: COPILOT_LAB_AUTOMATION_KEY },
    { $set: { sending: false } },
  );
}

async function findWatchedLoad(watchedLoad: string) {
  const trimmed = watchedLoad.trim();
  const byCompanyLoad = await TmsLoadModel.findOne({
    isActive: true,
    $or: [{ companyLoad: trimmed }, { customerLoad: trimmed }],
  }).lean();
  if (byCompanyLoad) {
    return byCompanyLoad;
  }

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return TmsLoadModel.findOne({ isActive: true, openroadLoadId: numeric }).lean();
}

/**
 * When the lab switch is on, send the one named load to tablet 999.
 * Returns immediately when the switch is off. Never targets another tablet.
 * Overlapping checks share one run so a slow Trimble call is not started twice.
 */
export function runTablet999AutoSend(): Promise<CopilotLabAutomationView> {
  if (autoSendInFlight) {
    return autoSendInFlight;
  }

  const run = runTablet999AutoSendInner().finally(() => {
    if (autoSendInFlight === run) {
      autoSendInFlight = null;
    }
  });
  autoSendInFlight = run;
  return run;
}

async function runTablet999AutoSendInner(): Promise<CopilotLabAutomationView> {
  const settings = await getSettings();
  if (!settings.enabled || !settings.watchedLoad?.trim()) {
    return toView(settings);
  }

  if (settings.lastStatus === "sent" || settings.lastStatus === "already-on-lab") {
    return toView(settings);
  }

  assertLabTablet(LAB_TABLET_ID);
  const watchedLoad = settings.watchedLoad.trim();

  const pulled = await pullWatchedLoad(watchedLoad);
  if (pulled.state === "missing") {
    const alreadyStored = await findWatchedLoad(watchedLoad);
    if (!alreadyStored) {
      return saveStatus(settings, {
        status: "waiting",
        detail: watchingMessage(watchedLoad),
      });
    }
  }
  if (pulled.state === "not-active") {
    return saveStatus(settings, {
      status: "waiting",
      detail: `On. Load ${watchedLoad} is ${pulled.status.replace(/_/g, " ")} in OpenRoad. It is sent to tablet 999 once a driver is assigned.`,
    });
  }

  if (!isTripManagementConfigured()) {
    return saveStatus(settings, {
      status: "error",
      detail: "Trimble Trip Management is not configured, so tablet 999 was not sent a trip.",
    });
  }

  try {
    const load = await findWatchedLoad(watchedLoad);
    const tmsTripId = load?.trimbleTrip?.tmsTripId?.trim() || "";
    const decision = decideTablet999AutoSend({
      tabletBusy: false,
      load: {
        found: Boolean(load),
        openroadLoadId: load?.openroadLoadId,
        geocodedStopCount: countGeocodedLoadStops(load?.destinations ?? []),
        tspDriverId: load?.trimbleTrip?.tspDriverId ?? null,
        ownedByOtherSystem: Boolean(
          tmsTripId && !isFuelOptimizerTmsTripId(tmsTripId) && !isLabTmsTripId(tmsTripId),
        ),
      },
    });

    if (decision !== "send") {
      if (decision === "busy") {
        return saveStatus(settings, { status: "busy", openroadLoadId: load?.openroadLoadId ?? null });
      }
      return saveStatus(settings, {
        status: decision,
        openroadLoadId: load?.openroadLoadId ?? null,
      });
    }

    const rawTrips = await searchTripsByDriverId(LAB_TABLET_ID);
    const activeTrip = pickTabletTrip(
      rawTrips.flatMap((trip) => {
        const view = toLabTripView(trip);
        return view ? [view] : [];
      }),
    );
    if (activeTrip) {
      const detail = activeTrip.isLabTrip
        ? "Clear lab trips on this page, then the next check will send this load."
        : "That trip was not created here. Finish or remove it on the tablet first. Clear lab trips will leave it alone.";
      return saveStatus(settings, {
        status: "busy",
        openroadLoadId: load?.openroadLoadId ?? null,
        detail,
      });
    }

    const claimed = await claimTablet999Send();
    if (!claimed) {
      return toView(await getSettings());
    }

    try {
      const sent = await dispatchTrimbleTripWithFuelStopForLoad(String(load!.openroadLoadId), {
        tspDriverId: LAB_TABLET_ID,
        allowTestTablet: true,
        useReplanDispatch: true,
      });
      const fuelStopCount = sent.fuelStops?.length ?? (sent.fuelStop ? 1 : 0);

      if (String(sent.tspDriverId ?? "").trim() !== LAB_TABLET_ID) {
        return saveStatus(settings, {
          status: "error",
          openroadLoadId: load!.openroadLoadId,
          detail: `The send did not stay on tablet ${LAB_TABLET_ID}. No other tablet was targeted again.`,
        });
      }

      return saveStatus(settings, {
        status: "sent",
        openroadLoadId: load!.openroadLoadId,
        fuelStopCount,
      });
    } finally {
      await releaseTablet999Send();
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return saveStatus(settings, {
      status: "error",
      detail: `Could not send load ${watchedLoad} to tablet 999. ${detail}`,
    });
  }
}
