import type { OpenRoadLoad, OpenRoadLoadDestination } from "../../../integrations/openroad";
import type { TmsLoadDestinationDocument } from "../models/tms-load.model";
import { parseOpenRoadCoordinate } from "../utils/tms-normalize";

function parseOpenRoadDate(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseNullableOpenRoadDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapOpenRoadDestination(destination: OpenRoadLoadDestination): TmsLoadDestinationDocument {
  return {
    openroadDestinationId: destination.id,
    position: destination.position,
    stopType: destination.stop_type,
    companyName: destination.stop_company_name,
    address: destination.address,
    city: destination.city,
    stateCode: destination.state_code,
    zipCode: destination.zip_code,
    lat: parseOpenRoadCoordinate(destination.lat),
    lng: parseOpenRoadCoordinate(destination.lng),
    appointmentDate: destination.app_date,
    timeFrom: parseOpenRoadDate(destination.time_from),
    timeTo: parseOpenRoadDate(destination.time_to),
    timeIn: parseNullableOpenRoadDate(destination.time_in),
    timeOut: parseNullableOpenRoadDate(destination.time_out),
    onTime: destination.on_time,
    arrivalStatus: destination.arrival_status,
    completed: Boolean(destination.completed),
    driverId: destination.driver_id,
  };
}

export function mapOpenRoadLoadFields(load: OpenRoadLoad) {
  const destinations = [...load.destinations]
    .sort((left, right) => left.position - right.position)
    .map(mapOpenRoadDestination);

  const pickup = destinations.find((destination) => destination.stopType === "pick_up") ?? destinations[0];
  const delivery =
    [...destinations].reverse().find((destination) => destination.stopType === "delivery") ??
    destinations[destinations.length - 1];

  return {
    status: load.status,
    customerLoad: load.customer_load,
    companyLoad: load.company_load,
    equipment: load.equipment,
    commodity: load.commodity,
    weight: load.weight,
    customerName: load.customer_name,
    hot: Boolean(load.hot),
    destinations,
    originCity: pickup?.city,
    originStateCode: pickup?.stateCode,
    destinationCity: delivery?.city,
    destinationStateCode: delivery?.stateCode,
  };
}
