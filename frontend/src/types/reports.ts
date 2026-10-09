export type DriverComplianceDriverRow = {
  driverId: number | null;
  driverName: string;
  assignedStops: number;
  followedStops: number;
  missedStops: number;
  arrivedStops: number;
  purchasedStops: number;
  gpsNearStops: number;
  compliancePercent: number;
};

export type DriverComplianceReport = {
  from: string;
  to: string;
  matchWindowDays: number;
  totals: {
    assignedStops: number;
    followedStops: number;
    missedStops: number;
    arrivedStops: number;
    purchasedStops: number;
    gpsNearStops: number;
    compliancePercent: number;
    driverCount: number;
  };
  drivers: DriverComplianceDriverRow[];
};
