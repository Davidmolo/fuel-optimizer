import { isOpenRoadConfigured, isOpenRoadExtConfigured } from "../../integrations/openroad";
import { getConfiguredRelayAccounts, type RelayAccount } from "../../integrations/relay";
import { isSamsaraConfigured } from "../../integrations/samsara";
import { syncFleetFromSamsara, syncFleetRegistry, syncFleetTelemetry } from "../fleet/services/fleet-sync.service";
import {
  getScheduledTransactionWindow,
  syncRelayDrivers,
  syncRelayTransactions,
  syncStationsFromRelay,
} from "../station/services/station-sync.service";
import { isTripManagementConfigured } from "../../integrations/trip-management";
import { runTablet999AutoSend } from "../copilot-lab/copilot-lab-automation.service";
import {
  syncTmsActiveLoads,
  syncTmsAssignments,
  syncTmsFleetRoster,
  syncTmsFromOpenRoad,
} from "../tms/services/tms-sync.service";
import { refreshActiveTrimbleTripFuelStopStatuses } from "../tms/services/trimble-trip.service";
import type { JobHandler, JobHandlerContext, JobId } from "./jobs.types";
import { SkipJobError } from "./skip-job-error";

function requireSamsara() {
  if (!isSamsaraConfigured()) {
    throw new SkipJobError("Samsara API token is not configured");
  }
}

function requireOpenRoad() {
  if (!isOpenRoadConfigured()) {
    throw new SkipJobError("Open Road API token is not configured");
  }
}

function requireOpenRoadExt() {
  if (!isOpenRoadExtConfigured()) {
    throw new SkipJobError(
      "Open Road External API v1 credentials are not configured — request client_id and client_secret from help@openroadtms.com",
    );
  }
}

function requireRelay() {
  if (getConfiguredRelayAccounts().length === 0) {
    throw new SkipJobError("Relay API keys are not configured");
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseRelayAccounts(value: unknown): RelayAccount[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const accounts = value.filter((item): item is RelayAccount => item === "blue_stallion" || item === "azfs");
  return accounts.length > 0 ? accounts : undefined;
}

function relaySyncOptions(context: JobHandlerContext) {
  return {
    dtstart: asString(context.payload?.dtstart),
    dtend: asString(context.payload?.dtend),
    accounts: parseRelayAccounts(context.payload?.accounts),
  };
}

const handlers: Record<JobId, JobHandler> = {
  async "samsara.telemetry"() {
    requireSamsara();
    return syncFleetTelemetry();
  },
  async "samsara.registry"() {
    requireSamsara();
    return syncFleetRegistry();
  },
  async "samsara.full"() {
    requireSamsara();
    return syncFleetFromSamsara();
  },
  async "openroad.loads"() {
    requireOpenRoadExt();
    return syncTmsActiveLoads();
  },
  async "openroad.assignments"() {
    requireOpenRoadExt();
    return syncTmsAssignments();
  },
  async "openroad.fleet"() {
    // Trucks and assignments come from the External API v1; the driver roster
    // still comes from the legacy V2 API, so both must be configured.
    requireOpenRoad();
    requireOpenRoadExt();
    return syncTmsFleetRoster();
  },
  async "openroad.full"() {
    requireOpenRoad();
    requireOpenRoadExt();
    return syncTmsFromOpenRoad();
  },
  async "relay.transactions"(context) {
    requireRelay();
    if (context.trigger === "schedule") {
      return syncRelayTransactions(getScheduledTransactionWindow());
    }
    return syncRelayTransactions(relaySyncOptions(context));
  },
  async "relay.drivers"(context) {
    requireRelay();
    return syncRelayDrivers(relaySyncOptions(context).accounts);
  },
  async "relay.full"(context) {
    requireRelay();
    return syncStationsFromRelay(relaySyncOptions(context));
  },
  async "trimble.trip-status"() {
    if (!isTripManagementConfigured()) {
      throw new SkipJobError("Trimble Trip Management is not configured");
    }
    return refreshActiveTrimbleTripFuelStopStatuses();
  },
  async "copilot-lab.auto-send"() {
    const automation = await runTablet999AutoSend();
    return {
      enabled: automation.enabled,
      tabletId: automation.tabletId,
      watchedLoad: automation.watchedLoad,
      status: automation.lastStatus,
      message: automation.lastMessage,
      openroadLoadId: automation.lastOpenroadLoadId,
    };
  },
};

export function getJobHandlers() {
  return handlers;
}
