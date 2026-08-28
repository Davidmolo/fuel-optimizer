import type { GeoPoint } from "../../utils/geo";

/**
 * Decodes a Google encoded polyline into lat/lng points.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodeEncodedPolyline(encoded: string): GeoPoint[] {
  const points: GeoPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const latitudeChange = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    latitude += latitudeChange;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const longitudeChange = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    longitude += longitudeChange;

    points.push({
      lat: latitude / 1e5,
      lng: longitude / 1e5,
    });
  }

  return points;
}
