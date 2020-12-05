export function isATVehicleRaw(obj: any): obj is ATVehicleRaw {
    return (
        typeof obj === "object" &&
        typeof obj.occupancy_status === "number" &&
        typeof obj.position === "object" &&
        typeof obj.position.bearing === "string" &&
        typeof obj.position.latitude === "number" &&
        typeof obj.position.longitude === "number" &&
        typeof obj.position.odometer === "number" &&
        typeof obj.position.speed === "number" &&
        typeof obj.timestamp === "number" &&
        typeof obj.trip === "object" &&
        typeof obj.trip.direction_id === "number" &&
        [0, 1].includes(obj.trip.direction_id) &&
        typeof obj.trip.route_id === "string" &&
        typeof obj.trip.schedule_relationship === "number" &&
        typeof obj.trip.start_date === "string" &&
        typeof obj.trip.start_time === "string" &&
        typeof obj.trip.trip_id === "string" &&
        typeof obj.vehicle === "object" &&
        typeof obj.vehicle.id === "string" &&
        typeof obj.vehicle.label === "string" &&
        typeof obj.vehicle.license_plate === "string"
    );
}

export function isATVehicleRawWS(obj: any): obj is ATVehicleRawWS {
    return (
        typeof obj === "object" &&
        typeof obj.occupancyStatus === "string" &&
        typeof obj.position === "object" &&
        typeof obj.position.latitude === "number" &&
        typeof obj.position.longitude === "number" &&
        typeof obj.timestamp === "string" &&
        typeof obj.trip === "object" &&
        typeof obj.trip.directionId === "number" &&
        [0, 1].includes(obj.trip.directionId) &&
        typeof obj.trip.routeId === "string" &&
        typeof obj.vehicle === "object" &&
        typeof obj.vehicle.id === "string"
    );
}
