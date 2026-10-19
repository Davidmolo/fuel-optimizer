"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Label from "@/components/common/label";
import Modal from "@/components/common/modal";
import Spinner from "@/components/common/spinner";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

type ProductionLabel =
  | "accepted"
  | "declined"
  | "waiting"
  | "not_sent"
  | "completed"
  | "canceled"
  | "unknown";

type LabStop = {
  stopType: string;
  label?: string;
  lat: number;
  lon: number;
};

type LabTrip = {
  alkTripId: string;
  tmsTripId: string | null;
  tripStatus: string;
  isLabTrip: boolean;
  isActive: boolean;
  productionLabel: ProductionLabel;
  stops: LabStop[];
  fuelStopCount: number;
  hasFuelStop: boolean;
};

type LabSnapshot = {
  tabletId: string;
  trips: LabTrip[];
  activeTrip: LabTrip | null;
  productionLabel: ProductionLabel;
  summary: string;
};

type LabActionResult = LabSnapshot & {
  action: string;
  verdict: string;
  reachedTablet: boolean;
  fuelStopCount: number;
  recommendationNote?: string;
  actedTrip: LabTrip | null;
};

type LabAction = "create" | "update-active" | "send-while-busy" | "cancel-lab-trips";
type ChoosableAction = Exclude<LabAction, "cancel-lab-trips">;
type FuelMode = "none" | "manual" | "recommendation";

type PointFields = {
  label: string;
  lat: string;
  lon: string;
};

const PRODUCTION_LABELS: Record<ProductionLabel, string> = {
  accepted: "Accepted",
  declined: "Declined",
  waiting: "Waiting",
  not_sent: "Not sent",
  completed: "Completed",
  canceled: "Canceled",
  unknown: "Unknown",
};

const ROUTE_PRESETS: Array<{
  id: string;
  title: string;
  detail: string;
  origin?: PointFields;
  destination?: PointFields;
}> = [
  {
    id: "short-hop",
    title: "Short hop",
    detail: "Denver to Colorado Springs",
    origin: { label: "Denver, CO", lat: "39.7392", lon: "-104.9903" },
    destination: { label: "Colorado Springs, CO", lat: "38.8339", lon: "-104.8214" },
  },
  {
    id: "corridor",
    title: "Long corridor",
    detail: "Godfrey, IL to Pioneer, OH",
    origin: { label: "Godfrey, IL", lat: "38.9556", lon: "-90.1868" },
    destination: { label: "Pioneer, OH", lat: "41.6806", lon: "-84.5527" },
  },
  { id: "custom", title: "Custom", detail: "Type your own stops" },
];

const FUEL_OPTIONS: Array<{ value: FuelMode; label: string }> = [
  { value: "none", label: "No fuel stop" },
  { value: "manual", label: "A stop I choose" },
  { value: "recommendation", label: "Let the engine choose" },
];

const EMPTY_STOP: PointFields = { label: "", lat: "", lon: "" };

function isOpenLabTrip(trip: LabTrip) {
  return (
    trip.isLabTrip &&
    trip.tripStatus !== "Completed" &&
    trip.tripStatus !== "Canceled" &&
    trip.tripStatus !== "Deleted"
  );
}

function stopSummary(trip: LabTrip) {
  if (trip.stops.length === 0) {
    return "Stops not listed yet";
  }
  return trip.stops.map((stop) => stop.label || stop.stopType).join(" → ");
}

function parsePoint(point: PointFields, name: string) {
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return `${name} needs a latitude and longitude.`;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return `${name} coordinates are out of range.`;
  }
  const label = point.label.trim();
  return { lat, lon, ...(label ? { label } : {}) };
}

function tabletHeadline(trip: LabTrip | null) {
  if (!trip) {
    return "Tablet is clear";
  }
  if (trip.tripStatus === "InProgress") {
    return "Driver is on this trip";
  }
  if (trip.tripStatus === "Dispatched" || trip.tripStatus === "ReceivedByClient") {
    return "Trip is reaching the tablet";
  }
  return `Tablet status is ${trip.tripStatus}`;
}

export default function CopilotLabPage() {
  const [snapshot, setSnapshot] = useState<LabSnapshot | null>(null);
  const [result, setResult] = useState<LabActionResult | null>(null);
  const [fetching, setFetching] = useState(true);
  const [pending, setPending] = useState<LabAction | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState(ROUTE_PRESETS[0]?.id ?? "custom");
  const [origin, setOrigin] = useState<PointFields>(ROUTE_PRESETS[0]?.origin ?? EMPTY_STOP);
  const [destination, setDestination] = useState<PointFields>(ROUTE_PRESETS[0]?.destination ?? EMPTY_STOP);
  const [fuelMode, setFuelMode] = useState<FuelMode>("none");
  const [manualStops, setManualStops] = useState<PointFields[]>([{ ...EMPTY_STOP }]);
  const [action, setAction] = useState<ChoosableAction>("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [showStops, setShowStops] = useState(false);

  const loadTablet = useCallback(async () => {
    const response = await apiRequest<LabSnapshot>("/api/v1/copilot-lab");
    if (!response.success || !response.data) {
      setError(response.message || "Unable to read tablet 999.");
      setSnapshot(null);
      return;
    }
    setError("");
    setSnapshot(response.data);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadTablet();
      setFetching(false);
    })();
  }, [loadTablet]);

  const activeTrip = snapshot?.activeTrip ?? null;
  const canCreate = !activeTrip;
  const canUpdate = Boolean(activeTrip?.isLabTrip);
  const canSendWhileBusy = Boolean(activeTrip);
  const canClear = (snapshot?.trips ?? []).some(isOpenLabTrip);
  const queuedTrips = (snapshot?.trips ?? []).filter((trip) => trip.alkTripId !== activeTrip?.alkTripId);

  useEffect(() => {
    const stillValid =
      (action === "create" && canCreate) ||
      (action === "update-active" && canUpdate) ||
      (action === "send-while-busy" && canSendWhileBusy);
    if (stillValid) {
      return;
    }
    if (canCreate) {
      setAction("create");
    } else if (canUpdate) {
      setAction("update-active");
    } else if (canSendWhileBusy) {
      setAction("send-while-busy");
    }
  }, [action, canCreate, canUpdate, canSendWhileBusy]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const next = ROUTE_PRESETS.find((item) => item.id === id);
    if (!next?.origin || !next.destination) {
      setShowStops(true);
      return;
    }
    setOrigin(next.origin);
    setDestination(next.destination);
    setShowStops(false);
  };

  const runAction = async (nextAction: LabAction) => {
    setError("");
    const body: Record<string, unknown> = { action: nextAction, fuelMode };

    if (nextAction !== "cancel-lab-trips") {
      const parsedOrigin = parsePoint(origin, "Pickup");
      const parsedDestination = parsePoint(destination, "Delivery");
      if (typeof parsedOrigin === "string") {
        setError(parsedOrigin);
        setShowStops(true);
        return;
      }
      if (typeof parsedDestination === "string") {
        setError(parsedDestination);
        setShowStops(true);
        return;
      }
      body.origin = parsedOrigin;
      body.destination = parsedDestination;
    }

    if (fuelMode === "manual" && nextAction !== "cancel-lab-trips") {
      const stops = [];
      for (const [index, stop] of manualStops.entries()) {
        const parsed = parsePoint(stop, `Fuel stop ${index + 1}`);
        if (typeof parsed === "string") {
          setError(parsed);
          return;
        }
        stops.push(parsed);
      }
      body.fuelStops = stops;
    }

    setPending(nextAction);
    const response = await apiRequest<LabActionResult>("/api/v1/copilot-lab/actions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setPending(null);

    if (!response.success || !response.data) {
      setError(response.message || "The lab action failed.");
      await loadTablet();
      return;
    }

    setResult(response.data);
    setSnapshot(response.data);
    setModalOpen(false);
  };

  const closeModal = useCallback(() => {
    if (pending) {
      return;
    }
    setModalOpen(false);
    setError("");
  }, [pending]);

  const openChoice = (nextAction: ChoosableAction) => {
    setAction(nextAction);
    setError("");
    setModalOpen(true);
  };

  const needsRoute = action !== "update-active";
  const primaryLabel =
    pending === action
      ? "Sending…"
      : action === "create"
        ? "Send this trip"
        : action === "update-active"
          ? fuelMode === "none"
            ? "Remove fuel stops"
            : "Update the trip"
          : "Send a second route";

  const choices: Array<{
    id: ChoosableAction;
    title: string;
    detail: string;
    reason: string;
    enabled: boolean;
  }> = [
    {
      id: "create",
      title: "Create a trip",
      detail: "The tablet is empty. Put a route on it.",
      reason: "A trip is already on the tablet.",
      enabled: canCreate,
    },
    {
      id: "update-active",
      title: "Update fuel",
      detail: "Keep this route. Change only the fuel stops.",
      reason: activeTrip && !activeTrip.isLabTrip ? "This trip was not created here." : "Create a trip first.",
      enabled: canUpdate,
    },
    {
      id: "send-while-busy",
      title: "Send while busy",
      detail: "Leave the current trip alone and try a second route.",
      reason: "Create a trip first.",
      enabled: canSendWhileBusy,
    },
  ];

  if (fetching) {
    return <Spinner label="Reading tablet 999..." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex w-full items-center gap-4">
        <div className="min-w-0 shrink-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">CoPilot lab</h2>
          <p className="mt-1 text-sm text-muted">Practice on tablet 999. Drivers on the road are never touched.</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {choices.map((choice) => {
            const primaryAction = canCreate ? "create" : canUpdate ? "update-active" : "send-while-busy";
            return (
              <Button
                key={choice.id}
                size="sm"
                variant={choice.enabled && choice.id === primaryAction ? "primary" : "secondary"}
                disabled={!choice.enabled || pending !== null}
                title={choice.enabled ? choice.detail : choice.reason}
                onClick={() => openChoice(choice.id)}
              >
                {choice.title}
              </Button>
            );
          })}
        </div>
      </div>

      {error && !modalOpen ? <Alert variant="error">{error}</Alert> : null}

      {result ? (
        <div
          className={cn(
            "rounded-[var(--radius-xl)] border px-5 py-4",
            result.reachedTablet ? "border-success/25 bg-success-muted" : "border-primary/15 bg-primary-muted",
          )}
        >
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Latest result</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{result.verdict}</p>
          {result.actedTrip ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip>{result.actedTrip.tripStatus}</StatusChip>
              <StatusChip>{result.actedTrip.hasFuelStop ? "Fuel on the trip" : "No fuel stop"}</StatusChip>
              <StatusChip>Production would show {PRODUCTION_LABELS[result.actedTrip.productionLabel]}</StatusChip>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Tablet 999</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{tabletHeadline(activeTrip)}</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {snapshot?.summary ?? "Tablet status is unavailable."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip tone={activeTrip ? "active" : "idle"}>
                {activeTrip ? activeTrip.tripStatus : "Idle"}
              </StatusChip>
              <StatusChip>
                Production would show {PRODUCTION_LABELS[activeTrip?.productionLabel ?? "not_sent"]}
              </StatusChip>
              {activeTrip ? (
                <StatusChip>
                  {activeTrip.hasFuelStop
                    ? `${activeTrip.fuelStopCount} fuel ${activeTrip.fuelStopCount === 1 ? "stop" : "stops"}`
                    : "No fuel stop"}
                </StatusChip>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadTablet()} disabled={pending !== null}>
              Refresh
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void runAction("cancel-lab-trips")}
              disabled={pending !== null || !canClear}
              title={canClear ? "Delete lab trips on tablet 999" : "No lab trips to clear"}
            >
              {pending === "cancel-lab-trips" ? "Clearing…" : "Clear lab trips"}
            </Button>
          </div>
        </div>

        {activeTrip ? (
          <div className="border-t border-border bg-surface-muted/70 px-5 py-4 sm:px-6">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">On the tablet now</p>
            <p className="mt-1 text-sm font-medium text-foreground">{activeTrip.tmsTripId ?? activeTrip.alkTripId}</p>
            <p className="mt-1 text-sm text-muted">{stopSummary(activeTrip)}</p>
          </div>
        ) : (
          <div className="border-t border-border px-5 py-4 text-sm text-muted sm:px-6">
            Nothing is running. Create a trip when you are ready.
          </div>
        )}

        {queuedTrips.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {queuedTrips.map((trip) => (
              <li key={trip.alkTripId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{trip.tmsTripId ?? trip.alkTripId}</p>
                  <p className="truncate text-xs text-muted">{stopSummary(trip)}</p>
                </div>
                <div className="flex gap-2">
                  <StatusChip>{trip.tripStatus}</StatusChip>
                  <StatusChip>{trip.isLabTrip ? "Lab" : "Not from this lab"}</StatusChip>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={choices.find((choice) => choice.id === action)?.title ?? "CoPilot lab"}
        subtitle={choices.find((choice) => choice.id === action)?.detail}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={pending !== null}>
              Cancel
            </Button>
            <Button onClick={() => void runAction(action)} disabled={pending !== null}>
              {primaryLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 px-4 py-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {needsRoute ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Route</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {ROUTE_PRESETS.map((item) => {
                  const selected = preset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyPreset(item.id)}
                      className={cn(
                        "rounded-[var(--radius-lg)] border px-3.5 py-3 text-left transition",
                        selected ? "border-primary bg-primary-muted" : "border-border hover:border-primary/30",
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{item.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Pickup and delivery stay on the trip already running.</p>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Fuel</p>
            <div className="flex flex-wrap gap-2">
              {FUEL_OPTIONS.map((option) => {
                const selected = fuelMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFuelMode(option.value)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-foreground hover:border-primary/40",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {fuelMode === "recommendation" ? (
              <p className="text-sm text-muted">
                Same fuel plan as production, assuming a quarter tank. A short hop may need no stop.
              </p>
            ) : null}
          </div>

          {fuelMode === "manual" ? (
            <div className="space-y-3">
              {manualStops.map((stop, index) => (
                <PointFieldsEditor
                  key={index}
                  title={`Fuel stop ${index + 1}`}
                  point={stop}
                  onChange={(next) =>
                    setManualStops((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                  }
                />
              ))}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={manualStops.length >= 3}
                  onClick={() => setManualStops((current) => [...current, { ...EMPTY_STOP }])}
                >
                  Add another stop
                </Button>
                {manualStops.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => setManualStops((current) => current.slice(0, -1))}>
                    Remove last
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {needsRoute ? (
            <div>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:text-primary-hover"
                onClick={() => setShowStops((current) => !current)}
              >
                {showStops ? "Hide coordinates" : "Edit pickup and delivery"}
              </button>
              {showStops ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <PointFieldsEditor title="Pickup" point={origin} onChange={setOrigin} />
                  <PointFieldsEditor title="Delivery" point={destination} onChange={setDestination} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {origin.label || "Pickup"} to {destination.label || "delivery"}
                </p>
              )}
            </div>
          ) : null}

        </div>
      </Modal>
    </div>
  );
}

function StatusChip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "active" | "idle" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "active" && "bg-primary-muted text-primary",
        tone === "idle" && "bg-success-muted text-success",
        tone === "neutral" && "bg-surface-muted text-muted ring-1 ring-border",
      )}
    >
      {children}
    </span>
  );
}

function PointFieldsEditor({
  title,
  point,
  onChange,
}: {
  title: string;
  point: PointFields;
  onChange: (point: PointFields) => void;
}) {
  const fieldId = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <fieldset className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-muted/40 p-4">
      <legend className="px-1 text-sm font-medium text-foreground">{title}</legend>
      <div>
        <Label htmlFor={`${fieldId}-label`}>Name</Label>
        <Input
          id={`${fieldId}-label`}
          value={point.label}
          onChange={(event) => onChange({ ...point, label: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${fieldId}-lat`}>Latitude</Label>
          <Input
            id={`${fieldId}-lat`}
            inputMode="decimal"
            value={point.lat}
            onChange={(event) => onChange({ ...point, lat: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${fieldId}-lon`}>Longitude</Label>
          <Input
            id={`${fieldId}-lon`}
            inputMode="decimal"
            value={point.lon}
            onChange={(event) => onChange({ ...point, lon: event.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}
