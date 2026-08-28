import type { JobDefinition } from "./jobs.types";

export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: "samsara.telemetry",
    name: "Samsara GPS & fuel",
    description: "Live truck position and fuel percent. Also runs from the Active loads Sync button.",
    cron: "*/5 * * * *",
    cadenceLabel: "Every 5 minutes",
    timeoutMs: 45_000,
    priority: 100,
    scheduled: true,
  },
  {
    id: "samsara.registry",
    name: "Samsara vehicle registry",
    description: "Vehicle list, VIN, and unit numbers. Changes rarely compared with live telemetry.",
    cron: "3 */6 * * *",
    cadenceLabel: "Every 6 hours",
    timeoutMs: 120_000,
    priority: 40,
    scheduled: true,
  },
  {
    id: "samsara.full",
    name: "Samsara full sync",
    description: "Registry plus telemetry. Used by the Fleet Sync button.",
    cron: null,
    cadenceLabel: "On demand",
    timeoutMs: 150_000,
    priority: 95,
    scheduled: false,
  },
  {
    id: "openroad.loads",
    name: "Open Road active loads",
    description: "Active loads and remaining stops that form the fuel-plan corridor.",
    cron: "2,12,22,32,42,52 * * * *",
    cadenceLabel: "Every 10 minutes",
    timeoutMs: 120_000,
    priority: 90,
    scheduled: true,
  },
  {
    id: "openroad.assignments",
    name: "Open Road assignments",
    description: "Driver-to-truck assignments required to attach a load to a Samsara vehicle.",
    cron: "7,22,37,52 * * * *",
    cadenceLabel: "Every 15 minutes",
    timeoutMs: 120_000,
    priority: 80,
    scheduled: true,
  },
  {
    id: "openroad.fleet",
    name: "Open Road trucks & drivers",
    description: "Truck roster, drivers, and VIN linking to Samsara.",
    cron: "17 */2 * * *",
    cadenceLabel: "Every 2 hours",
    timeoutMs: 180_000,
    priority: 50,
    scheduled: true,
  },
  {
    id: "openroad.full",
    name: "Open Road full sync",
    description: "Fleet, assignments, and active loads. Paired with live GPS/fuel on the Active loads Sync button.",
    cron: null,
    cadenceLabel: "On demand",
    timeoutMs: 300_000,
    priority: 95,
    scheduled: false,
  },
  {
    id: "relay.transactions",
    name: "Relay station prices",
    description: "Contracted station locations and diesel prices from recent fuel transactions.",
    cron: "33 */2 * * *",
    cadenceLabel: "Every 2 hours",
    timeoutMs: 300_000,
    priority: 30,
    scheduled: true,
  },
  {
    id: "relay.drivers",
    name: "Relay drivers",
    description: "Fuel-card driver roster. Not required for live recommendations.",
    cron: "47 */6 * * *",
    cadenceLabel: "Every 6 hours",
    timeoutMs: 180_000,
    priority: 20,
    scheduled: true,
  },
  {
    id: "relay.full",
    name: "Relay full sync",
    description: "Drivers plus 30-day station backfill. Used by the Stations Sync button.",
    cron: null,
    cadenceLabel: "On demand",
    timeoutMs: 420_000,
    priority: 70,
    scheduled: false,
  },
];

const JOB_DEFINITION_BY_ID = new Map(JOB_DEFINITIONS.map((job) => [job.id, job]));

export function getJobDefinition(jobId: string) {
  return JOB_DEFINITION_BY_ID.get(jobId as JobDefinition["id"]);
}

export function getScheduledJobDefinitions() {
  return JOB_DEFINITIONS.filter((job) => job.scheduled && job.cron);
}
