import { getAngleOfLine, getClosestPointOnPath, isPointEqual } from "~/helpers";
import logger from "~/logger";
import { mercatorProjection } from "~/MercatorProjection";
import { convertPixelToLatLngPixel } from "./normalizers";

export function snapVehicleToPolyline(polyline: PolylineLatLngPixel[], vehicle: LatLng): {
    snapPosition: LatLngPixel;
    snapDist: number;
    snapBearing: number;
} {
    const vehiclePixel = mercatorProjection.fromLatLngToPoint(vehicle);
    const { point: snapPixel, lineIndices } = getClosestPointOnPath(polyline, vehiclePixel);
    const snapPosition = convertPixelToLatLngPixel(snapPixel);

    const avgLat = (vehicle.lat + snapPosition.lat) / 2;
    const snapDist = mercatorProjection.getDistBetweenPoints(vehiclePixel, snapPosition, avgLat);

    lineIndices.sort();

    // can't calculate bearing between two identical points
    while (isPointEqual(polyline[lineIndices[0]],  polyline[lineIndices[1]])) {
        // try calculate bearing to next point on the line
        if (lineIndices[1] < polyline.length - 1) {
            lineIndices[1]++;
        }
        // try calculate bearing from previous point on the line
        else if (lineIndices[0] > 0) {
            lineIndices[0]--;
        }
        // this is bad, means that all points on the line are identical
        else {
            logger.warn("snapVehicleToPolyline", "all points on the line are identical", polyline, vehicle);
            return { snapPosition, snapDist, snapBearing: -1 };
        }
    }
    const snapBearing = getAngleOfLine(polyline[lineIndices[0]], polyline[lineIndices[1]]);

    return { snapPosition, snapDist, snapBearing };
}
