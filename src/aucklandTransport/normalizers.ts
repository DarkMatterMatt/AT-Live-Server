import { round } from "~/helpers";
import { mercatorProjection } from "~/MercatorProjection";

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

export function convertATVehicleRawToATVehicle(data: ATVehicleRaw): ATVehicle {
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

export function convertATVehicleRawWSToATVehicle(data: ATVehicleRawWS): ATVehicle {
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

export function convertATShapePointRawToLatLngs(points: ATShapePointRaw[]): LatLng[] {
    return points.map(p => ({ lat: p.shape_pt_lat, lng: p.shape_pt_lon }));
}

export function convertPointsToLatLngs(points: Point[]): LatLng[] {
    return points.map(p => ({ lat: p.x, lng: p.y }));
}

export function convertLatLngsToPolylinePoints(points: LatLng[]): PolylineLatLng[] {
    const output: PolylineLatLng[] = new Array(points.length);
    output[0] = { lat: points[0].lat, lng: points[0].lng, dist: 0 };

    let dist = 0;
    for (let i = 1; i < points.length; i++) {
        dist += mercatorProjection.getDistBetweenLatLngs(points[i - 1], points[i]);

        const { lat, lng } = points[i];
        output[i] = { lat, lng, dist: round(dist, 2) };
    }
    return output;
}

export function convertPolylinePointsToPoints(points: PolylineLatLng[]): Point[] {
    return points.map(p => ({ x: p.lat, y: p.lng }));
}
