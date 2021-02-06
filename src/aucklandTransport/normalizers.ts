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

export function convertATVehicleRawToATVehicleUnprocessed(data: ATVehicleRaw): ATVehicleUnprocessed {
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

export function convertATVehicleRawWSToATVehicleUnprocessed(data: ATVehicleRawWS): ATVehicleUnprocessed {
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

export function convertATVehicleToOutputVehicle(route: ATRoute, vehicle: ATVehicle): OutputVehicle {
    return {
        status: "success",
        route: "live/vehicle",

        shortName: route.shortName,
        routeId: vehicle.routeId,
        directionId: vehicle.directionId,
        lastUpdatedUnix: vehicle.lastUpdated / 1000,
        lastUpdated: vehicle.lastUpdated,

        position: vehicle.position,
        vehicleId: vehicle.vehicleId,
        occupancyStatus: vehicle.occupancyStatus,

        snapPosition: vehicle.snapPosition,
        snapDeviation: vehicle.snapDeviation,
        snapBearing: vehicle.snapBearing,
    };
}

export function convertLatLngToLatLngPixel(latLng: LatLng): LatLngPixel {
    return { ...latLng, ...mercatorProjection.fromLatLngToPoint(latLng) };
}

export function convertLatLngsToLatLngPixels(latLngs: LatLng[]): LatLngPixel[] {
    return latLngs.map(l => ({ ...l, ...mercatorProjection.fromLatLngToPoint(l) }));
}

export function convertLatLngsToPolylineLatLngPixels(latLngs: LatLng[]): PolylineLatLngPixel[] {
    return convertLatLngsPixelsToPolylineLatLngPixels(convertLatLngsToLatLngPixels(latLngs));
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

export function convertLatLngsPixelsToPolylineLatLngPixels(latLngPixels: LatLngPixel[]): PolylineLatLngPixel[] {
    const output: PolylineLatLngPixel[] = new Array(latLngPixels.length);
    output[0] = { ...latLngPixels[0], dist: 0 };

    let dist = 0;
    for (let i = 1; i < latLngPixels.length; i++) {
        const avgLat = (latLngPixels[i - 1].lat + latLngPixels[i].lat) / 2;
        dist += mercatorProjection.getDistBetweenPoints(latLngPixels[i - 1], latLngPixels[i], avgLat);

        output[i] = { ...latLngPixels[i], dist: round(dist, 2) };
    }
    return output;
}

export function convertPixelToLatLngPixel(pixel: Pixel): LatLngPixel {
    return { ...pixel, ...mercatorProjection.fromPointToLatLng(pixel) };
}

export function toLatLng(latLng: LatLng): LatLng {
    return {
        lat: latLng.lat,
        lng: latLng.lng,
    };
}

export function toPoint(point: Point): Point {
    return {
        x: point.x,
        y: point.y,
    };
}
