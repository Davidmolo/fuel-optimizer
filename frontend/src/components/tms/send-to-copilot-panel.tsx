"use client";

import { useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CopilotSendInfo, TripContext } from "@/types/tms";

type SendToCopilotPanelProps = {
  trip: TripContext;
  onSent?: () => Promise<void> | void;
};

function acceptLabel(status: CopilotSendInfo["driverAcceptStatus"]) {
  switch (status) {
    case "accepted":
      return "Driver accepted";
    case "waiting":
      return "Waiting for accept";
    case "declined":
      return "Driver declined";
    case "completed":
      return "Trip completed";
    case "canceled":
      return "Trip canceled";
    case "not_sent":
      return "Not sent";
    default:
      return "Status unknown";
  }
}

function acceptTone(status: CopilotSendInfo["driverAcceptStatus"]) {
  switch (status) {
    case "accepted":
    case "completed":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "waiting":
      return "bg-sky-50 text-sky-800 ring-sky-100";
    case "declined":
    case "canceled":
      return "bg-red-50 text-red-700 ring-red-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function SendToCopilotPanel({ trip, onSent }: SendToCopilotPanelProps) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const copilot = trip.copilot;
  const trimble = trip.load.trimbleTrip;
  const canSend = Boolean(copilot?.canSend);
  const alreadySent = Boolean(
    trimble?.tripStatus &&
      ["Dispatched", "ReceivedByClient", "InProgress", "Completed"].includes(trimble.tripStatus),
  );

  async function handleSend() {
    setSending(true);
    setMessage("");
    setIsError(false);

    const result = await apiRequest(`/api/v1/tms/loads/${trip.load.id}/trimble-trip/send-to-copilot`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    setSending(false);

    if (!result.success) {
      setIsError(true);
      setMessage(result.message || "Unable to send to CoPilot");
      return;
    }

    setIsError(false);
    setMessage(result.message || "Sent to CoPilot");
    await onSent?.();
  }

  return (
    <div className="border-b border-border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">CoPilot</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {trimble?.tripStatus ? `Trip ${trimble.tripStatus}` : "Not on CoPilot yet"}
          </p>
          {trimble?.tspDriverId ? (
            <p className="mt-0.5 truncate text-xs text-muted">Tablet {trimble.tspDriverId}</p>
          ) : trip.vehicle?.trimbleAssetId ? (
            <p className="mt-0.5 truncate text-xs text-muted">Tablet {trip.vehicle.trimbleAssetId}</p>
          ) : null}
        </div>
        {copilot ? (
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              acceptTone(copilot.driverAcceptStatus),
            )}
          >
            {acceptLabel(copilot.driverAcceptStatus)}
          </span>
        ) : null}
      </div>

      {(() => {
        const fuelStops =
          trimble?.fuelStops?.length
            ? trimble.fuelStops
            : trimble?.fuelStop
              ? [trimble.fuelStop]
              : [];
        if (fuelStops.length === 0) {
          return trimble?.lastRecommendationMessage ? (
            <p className="mt-2 text-xs text-amber-800">{trimble.lastRecommendationMessage}</p>
          ) : null;
        }
        return (
          <ul className="mt-2 space-y-1">
            {fuelStops.map((stop, index) => (
              <li key={`${stop.relayLocationId}-${stop.stopIndex}`} className="truncate text-xs text-muted">
                Fuel {index + 1}:{" "}
                {[stop.merchantName || stop.name, stop.city, stop.state].filter(Boolean).join(", ")}
                {typeof stop.effectivePricePerGallon === "number"
                  ? ` · $${stop.effectivePricePerGallon.toFixed(3)}/gal`
                  : ""}
              </li>
            ))}
          </ul>
        );
      })()}

      {message ? (
        <div className="mt-2">
          <Alert variant={isError ? "error" : "success"}>{message}</Alert>
        </div>
      ) : null}

      {!canSend && copilot?.blockedReason ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{copilot.blockedReason}</p>
      ) : null}

      <div className="mt-3">
        <Button
          fullWidth
          disabled={sending || !canSend}
          onClick={() => void handleSend()}
          title={!canSend ? copilot?.blockedReason : undefined}
        >
          {sending ? "Sending…" : alreadySent ? "Resend to CoPilot" : "Send to CoPilot"}
        </Button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          Plans the trip if needed, inserts every required fuel stop along the route automatically, then notifies the
          driver’s tablet.
        </p>
      </div>
    </div>
  );
}
