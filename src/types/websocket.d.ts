
interface ATVehicleRawWS {
    trip: {
        routeId: string;
        directionId: 0 | 1;
    };
    vehicle: {
        id: string;
    };
    position: {
        latitude: number;
        longitude: number;
    };
    timestamp: string;
    occupancyStatus: string;
}
