import { model, Schema } from "mongoose";

export const COPILOT_LAB_AUTOMATION_KEY = "tablet-999";

export const COPILOT_LAB_AUTOMATION_STATUSES = [
  "off",
  "waiting",
  "busy",
  "sent",
  "already-on-lab",
  "blocked-fleet",
  "blocked-other-system",
  "not-ready",
  "error",
] as const;

export type CopilotLabAutomationStatus = (typeof COPILOT_LAB_AUTOMATION_STATUSES)[number];

export type CopilotLabAutomationDocument = {
  key: string;
  enabled: boolean;
  /** OpenRoad load id or company load number Mantas typed in. */
  watchedLoad: string | null;
  enabledAt: Date | null;
  lastRunAt: Date | null;
  lastOpenroadLoadId: number | null;
  lastStatus: CopilotLabAutomationStatus;
  lastMessage: string;
  /** True while a send to tablet 999 is in flight, so two processes do not dispatch twice. */
  sending?: boolean;
  sendingStartedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const copilotLabAutomationSchema = new Schema<CopilotLabAutomationDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    enabled: { type: Boolean, default: false },
    watchedLoad: { type: String, trim: true, default: null },
    enabledAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastOpenroadLoadId: { type: Number, default: null },
    lastStatus: {
      type: String,
      enum: COPILOT_LAB_AUTOMATION_STATUSES,
      default: "off",
    },
    lastMessage: {
      type: String,
      default: "Off. Tablet 999 will not receive a load.",
    },
    sending: { type: Boolean, default: false },
    sendingStartedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const CopilotLabAutomationModel = model<CopilotLabAutomationDocument>(
  "CopilotLabAutomation",
  copilotLabAutomationSchema,
);
