import { isOpenRoadConfigured } from "../../integrations/openroad";
import { getConfiguredRelayAccounts, type RelayAccount } from "../../integrations/relay";
import { isSamsaraConfigured } from "../../integrations/samsara";
import { syncFleetFromSamsara, syncFleetRegistry, syncFleetTelemetry } from "../fleet/services/fleet-sync.service";
import {
  getScheduledTransactionWindow,
  syncRelayDrivers,
  syncRelayTransactions,
  syncStationsFromRelay,
} from "../station/services/station-sync.service";
import {
  syncTmsActiveLoads,
  syncTmsAssignments,
  syncTmsFleetRoster,
  syncTmsFromOpenRoad,
} from "../tms/services/tms-sync.service";
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
    requireOpenRoad();
    return syncTmsActiveLoads();
  },
  async "openroad.assignments"() {
    requireOpenRoad();
    return syncTmsAssignments();
  },
  async "openroad.fleet"() {
    requireOpenRoad();
    return syncTmsFleetRoster();
  },
  async "openroad.full"() {
    requireOpenRoad();
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
};

export function getJobHandlers() {
  return handlers;
}
