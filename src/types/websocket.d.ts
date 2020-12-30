export interface ATVehicleRawWS {
    trip: {
        tripId: string;
        startTime: string;
        startDate: string;
        scheduleRelationship: string;
        routeId: string;
        directionId: 0 | 1;
    };
    position: {
        latitude: number;
        longitude: number;
        bearing: number;
        odometer: number;
        speed: number;
    };
    timestamp: string;
    vehicle: {
        id: string;
        label: string;
        licensePlate: string;
    };
    occupancyStatus: string;
}
