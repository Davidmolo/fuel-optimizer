/**
 * Types for the Open Road TMS External API v1 (`/api/ext/v1`).
 *
 * Open Road removed loads, trucks, and assignments from the legacy V2 API, so
 * those resources are read from the External API v1 and mapped onto the legacy
 * `OpenRoad*` types (see `openroad.types.ts`) that the sync services consume.
 *
 * Reference: https://app.openroadtms.com/llms-full.txt
 */

export type OpenRoadExtEnvelope<TData> = {
  data: TData | null;
  error: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; code?: string; message?: string }>;
  } | null;
  meta?: {
    request_id?: string;
    timestamp?: string;
    page?: number;
    per_page?: number;
    total?: number;
  };
};

export type OpenRoadExtDestination = {
  id: number;
  position: number;
  stop_type: string;
  stop_company_name?: string | null;
  address?: string | null;
  city?: string | null;
  state_code?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  on_time?: boolean | null;
  arrival_status?: string | null;
  completed?: boolean | null;
  load_id?: number;
  driver_id?: number | null;
  trailer_id?: number | null;
  app_date?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  time_in?: string | null;
  time_out?: string | null;
};

export type OpenRoadExtLoad = {
  id: number;
  status: string;
  customer_load?: string | null;
  /** Open Road internal load reference (V2 called this `company_load`). */
  gp_load?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  equipment?: string | null;
  commodity?: string | null;
  /** Free-form string that may contain commas, e.g. `"44,500.0"`. */
  weight?: string | null;
  size?: string | null;
  temperature?: string | null;
  hot?: boolean | null;
  destinations?: OpenRoadExtDestination[] | null;
};

export type OpenRoadExtTruck = {
  id: number;
  unit?: string | null;
  status: string;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
  state_code?: string | null;
  odometer?: string | null;
  /** Free-form string, e.g. `"240"` or empty. */
  fuel_tank_capacity?: string | null;
};

export type OpenRoadExtDriverSummary = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  driver_nr?: string | null;
  status?: string | null;
};

export type OpenRoadExtEquipmentSummary = {
  id: number;
  unit?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
};

export type OpenRoadExtAssignment = {
  id: number;
  driver_id: number;
  assignment_id: number;
  assignment_type: string;
  start_date?: string | null;
  /** `null` means the assignment is currently active. */
  end_date?: string | null;
  driver?: OpenRoadExtDriverSummary | null;
  assignment?: OpenRoadExtEquipmentSummary | null;
};
