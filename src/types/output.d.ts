interface Output {
    publish: (shortName: string, data: OutputVehicle) => void;
}

interface OutputVehicle {
    status: "success",
    /** Websocket JSON route, not the vehicle's transit route */
    route: "live/vehicle",

    shortName: string;
    routeId: string;
    directionId: 0 | 1;
    lastUpdatedUnix: number;
    /** JavaScript timestamp (milliseconds since Epoch) */
    lastUpdated: number;
    /** Unprocessed reported GPS location */
    position: LatLng;
    vehicleId: string;
    occupancyStatus: number;

    /** Closest position on route to reported position */
    snapPosition: LatLng;
    /** Distance (meters) between reported position and calculated position */
    snapDeviation: number;
}
