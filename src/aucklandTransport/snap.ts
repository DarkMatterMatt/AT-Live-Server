import { getClosestPointOnPath } from "~/helpers";
import { mercatorProjection } from "~/MercatorProjection";
import { convertPixelToLatLngPixel } from "./normalizers";

export function snapVehicleToPolyline(polyline: PolylineLatLngPixel[], vehicle: LatLng): {
    snapPosition: LatLngPixel;
    snapDist: number;
} {
    const vehiclePixel = mercatorProjection.fromLatLngToPoint(vehicle);
    const snapPixel = getClosestPointOnPath(polyline, vehiclePixel);
    const snapPosition = convertPixelToLatLngPixel(snapPixel);

    const avgLat = (vehicle.lat + snapPosition.lat) / 2;
    const snapDist = mercatorProjection.getDistBetweenPoints(vehiclePixel, snapPosition, avgLat);

    return { snapPosition, snapDist };
}
