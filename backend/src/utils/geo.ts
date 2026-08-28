export type GeoPoint = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMiles(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolatePoint(a: GeoPoint, b: GeoPoint, fraction: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * fraction,
    lng: a.lng + (b.lng - a.lng) * fraction,
  };
}

export function distanceToSegmentMiles(point: GeoPoint, segmentStart: GeoPoint, segmentEnd: GeoPoint) {
  const segmentLength = haversineDistanceMiles(segmentStart, segmentEnd);

  if (segmentLength === 0) {
    return haversineDistanceMiles(point, segmentStart);
  }

  let low = 0;
  let high = 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const left = (2 * low + high) / 3;
    const right = (low + 2 * high) / 3;
    const leftPoint = interpolatePoint(segmentStart, segmentEnd, left);
    const rightPoint = interpolatePoint(segmentStart, segmentEnd, right);
    const leftDistance = haversineDistanceMiles(point, leftPoint);
    const rightDistance = haversineDistanceMiles(point, rightPoint);

    if (leftDistance < rightDistance) {
      high = right;
      bestDistance = Math.min(bestDistance, leftDistance);
    } else {
      low = left;
      bestDistance = Math.min(bestDistance, rightDistance);
    }
  }

  return bestDistance;
}

export function minDistanceToPolylineMiles(point: GeoPoint, polyline: GeoPoint[]) {
  if (polyline.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (polyline.length === 1) {
    return haversineDistanceMiles(point, polyline[0]);
  }

  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const segmentDistance = distanceToSegmentMiles(point, polyline[index], polyline[index + 1]);
    minDistance = Math.min(minDistance, segmentDistance);
  }

  return minDistance;
}

export function isPointInCorridor(point: GeoPoint, polyline: GeoPoint[], bufferMiles: number) {
  if (polyline.length === 0) {
    return false;
  }

  return minDistanceToPolylineMiles(point, polyline) <= bufferMiles;
}

type PolylineProjection = {
  segmentIndex: number;
  distanceAlongPolylineMiles: number;
  distanceToPolylineMiles: number;
};

function projectPointOntoPolyline(point: GeoPoint, polyline: GeoPoint[]): PolylineProjection {
  if (polyline.length === 0) {
    return {
      segmentIndex: 0,
      distanceAlongPolylineMiles: 0,
      distanceToPolylineMiles: Number.POSITIVE_INFINITY,
    };
  }

  if (polyline.length === 1) {
    return {
      segmentIndex: 0,
      distanceAlongPolylineMiles: 0,
      distanceToPolylineMiles: haversineDistanceMiles(point, polyline[0]),
    };
  }

  let bestSegmentIndex = 0;
  let bestDistanceAlong = 0;
  let bestDistanceToPolyline = Number.POSITIVE_INFINITY;
  let cumulativeDistance = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const segmentStart = polyline[index];
    const segmentEnd = polyline[index + 1];
    const segmentLength = haversineDistanceMiles(segmentStart, segmentEnd);

    let low = 0;
    let high = 1;
    let bestFraction = 0;
    let segmentBestDistance = Number.POSITIVE_INFINITY;

    for (let iteration = 0; iteration < 12; iteration += 1) {
      const left = (2 * low + high) / 3;
      const right = (low + 2 * high) / 3;
      const leftPoint = interpolatePoint(segmentStart, segmentEnd, left);
      const rightPoint = interpolatePoint(segmentStart, segmentEnd, right);
      const leftDistance = haversineDistanceMiles(point, leftPoint);
      const rightDistance = haversineDistanceMiles(point, rightPoint);

      if (leftDistance < rightDistance) {
        high = right;
        if (leftDistance < segmentBestDistance) {
          segmentBestDistance = leftDistance;
          bestFraction = left;
        }
      } else {
        low = left;
        if (rightDistance < segmentBestDistance) {
          segmentBestDistance = rightDistance;
          bestFraction = right;
        }
      }
    }

    const distanceAlong = cumulativeDistance + segmentLength * clamp(bestFraction, 0, 1);

    if (segmentBestDistance < bestDistanceToPolyline) {
      bestDistanceToPolyline = segmentBestDistance;
      bestSegmentIndex = index;
      bestDistanceAlong = distanceAlong;
    }

    cumulativeDistance += segmentLength;
  }

  return {
    segmentIndex: bestSegmentIndex,
    distanceAlongPolylineMiles: bestDistanceAlong,
    distanceToPolylineMiles: bestDistanceToPolyline,
  };
}

export function distanceAlongPolylineMiles(point: GeoPoint, polyline: GeoPoint[]) {
  return projectPointOntoPolyline(point, polyline).distanceAlongPolylineMiles;
}

export function isPointAheadOnPolyline(
  point: GeoPoint,
  referencePoint: GeoPoint,
  polyline: GeoPoint[],
  minAheadMiles = 1,
) {
  const referenceProjection = projectPointOntoPolyline(referencePoint, polyline);
  const pointProjection = projectPointOntoPolyline(point, polyline);

  return pointProjection.distanceAlongPolylineMiles > referenceProjection.distanceAlongPolylineMiles + minAheadMiles;
}

export function polylineLengthMiles(polyline: GeoPoint[]) {
  if (polyline.length < 2) {
    return 0;
  }

  let total = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    total += haversineDistanceMiles(polyline[index], polyline[index + 1]);
  }

  return total;
}

function milesToLatitudeDegrees(miles: number) {
  return miles / 69;
}

function milesToLongitudeDegrees(miles: number, latitude: number) {
  const latitudeRadians = toRadians(latitude);
  const milesPerDegree = 69 * Math.cos(latitudeRadians);

  if (milesPerDegree <= 0) {
    return miles / 69;
  }

  return miles / milesPerDegree;
}

export type GeoBoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function buildPolylineBoundingBox(points: GeoPoint[], paddingMiles: number): GeoBoundingBox | null {
  if (points.length === 0) {
    return null;
  }

  const centerLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const latPadding = milesToLatitudeDegrees(paddingMiles);
  const lngPadding = milesToLongitudeDegrees(paddingMiles, centerLat);

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat - latPadding);
    maxLat = Math.max(maxLat, point.lat + latPadding);
    minLng = Math.min(minLng, point.lng - lngPadding);
    maxLng = Math.max(maxLng, point.lng + lngPadding);
  }

  return {
    minLat,
    maxLat,
    minLng: Math.max(-180, minLng),
    maxLng: Math.min(180, maxLng),
  };
}
