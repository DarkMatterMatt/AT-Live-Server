import { getClosestPointOnPath } from "~/helpers";
import { mercatorProjection } from "~/MercatorProjection";
import { convertPixelToLatLngPixel } from "./normalizers";

export function snapBusToPolyline(polyline: PolylineLatLngPixel, bus: LatLng): {
    snapPosition: LatLngPixel;
    snapDist: number;
} {
    const busPixel = mercatorProjection.fromLatLngToPoint(bus);
    const snapPosition = convertPixelToLatLngPixel(getClosestPointOnPath(polyline, busPixel));

    const avgLat = (bus.lat + snapPosition.lat) / 2;
    const snapDist = mercatorProjection.getDistBetweenPoints(bus, snapPosition, avgLat);

    return { snapPosition, snapDist };
}
