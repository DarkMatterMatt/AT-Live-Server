import { isATVehicleRaw } from "./typeChecks";


// https://developers.google.com/transit/gtfs/reference#routestxt
const TRANSIT_TYPES = ["tram", "subway", "rail", "bus", "ferry"];

const OCCUPANCY_STATUSES = [
    "EMPTY",
    "MANY_SEATS_AVAILABLE",
    "FEW_SEATS_AVAILABLE",
    "STANDING_ROOM_ONLY",
    "CRUSHED_STANDING_ROOM_ONLY",
    "FULL",
    "NOT_ACCEPTING_PASSENGERS",
];

export function convertATVehicleRawToATVehicle(data: ATVehicleRaw | ATVehicleRawWS): ATVehicle {
    if (isATVehicleRaw(data)) {
        return {
            directionId: data.trip.direction_id,
            lastUpdatedUnix: data.timestamp,
            occupancyStatus: data.occupancy_status,
            position: {
                lat: data.position.latitude,
                lng: data.position.longitude,
            },
            routeId: data.trip.route_id,
            vehicleId: data.vehicle.id,
        };
    }
    return {
        directionId: data.trip.directionId,
        lastUpdatedUnix: Number.parseInt(data.timestamp),
        occupancyStatus: OCCUPANCY_STATUSES.indexOf(data.occupancyStatus),
        position: {
            lat: data.position.latitude,
            lng: data.position.longitude,
        },
        routeId: data.trip.routeId,
        vehicleId: data.vehicle.id,
    };
}
