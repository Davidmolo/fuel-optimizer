export type OpenRoadPaginationMeta = {
  total_pages: number;
  current_page: number;
  next_page: number | null;
  prev_page: number | null;
  total_count: number;
};

export type OpenRoadTruck = {
  id: number;
  unit: string;
  status: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  license_plate?: string;
  state_code?: string;
  odometer?: string;
  fuel_tank_capacity_gallons?: number;
};

export type OpenRoadDriver = {
  id: number;
  employee_nr?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  phone?: string;
  email?: string | null;
  status?: string;
  position?: string;
  terminal?: string;
  team?: string;
};

export type OpenRoadAssignment = {
  id: number;
  driver_id: number;
  driver_name?: string;
  driver_nr?: string;
  driver_phone?: string;
  driver_team?: string;
  driver_team_manager?: string;
  assignment_id: number;
  assignment_type: string;
  assignment_unit: string;
  start_date?: string;
  end_date?: string | null;
};

export type OpenRoadLoadDestination = {
  id: number;
  position: number;
  stop_type: string;
  stop_company_name?: string;
  address?: string;
  city?: string;
  state_code?: string;
  zip_code?: string;
  phone?: string;
  lat?: string;
  lng?: string;
  app_date?: string;
  time_from?: string;
  time_to?: string;
  time_in?: string | null;
  time_out?: string | null;
  on_time?: boolean;
  arrival_status?: string | null;
  completed?: boolean;
  driver_id?: number;
  trailer_id?: number | null;
};

export type OpenRoadLoad = {
  id: number;
  status: string;
  customer_load?: string;
  company_load?: string;
  equipment?: string;
  commodity?: string;
  weight?: number;
  temperature?: string;
  size?: string;
  hot?: boolean;
  customer_id?: number;
  customer_name?: string;
  destinations: OpenRoadLoadDestination[];
};

export type OpenRoadFuelCardTransaction = {
  id: number;
  transaction_date?: string;
  driver_id?: number;
  merchant_name?: string;
  location?: string;
  gallons?: number;
  amount?: number;
};

export type OpenRoadTrucksResponse = OpenRoadPaginationMeta & {
  trucks: OpenRoadTruck[];
};

export type OpenRoadDriversResponse = OpenRoadPaginationMeta & {
  drivers: OpenRoadDriver[];
};

export type OpenRoadAssignmentsResponse = OpenRoadPaginationMeta & {
  assignments: OpenRoadAssignment[];
};

export type OpenRoadLoadsResponse = OpenRoadPaginationMeta & {
  loads: OpenRoadLoad[];
};

export type OpenRoadFuelCardTransactionsResponse = OpenRoadPaginationMeta & {
  fuel_card_transactions?: OpenRoadFuelCardTransaction[];
  transactions?: OpenRoadFuelCardTransaction[];
};
