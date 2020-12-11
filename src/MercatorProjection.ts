import { clamp } from "~/helpers";

const ALMOST_ONE = 1 - 1E-15;

class MercatorProjection implements MapProjection {
    private tileSize: number;
    private pixelOrigin: Point;
    private pixelsPerLonDegree: number;
    private pixelsPerLonRadian: number;

    public constructor(tileSize: number) {
        this.tileSize = tileSize;
        this.pixelOrigin = { x: tileSize / 2, y: tileSize / 2 };
        this.pixelsPerLonDegree = tileSize / 360;
        this.pixelsPerLonRadian = tileSize / (2 * Math.PI);
    }

    private static degreesToRadians(deg: number): number {
        return deg * Math.PI / 180;
    }

    private static radiansToDegrees(rad: number): number {
        return 180 * rad / Math.PI;
    }

    private static clampLng(lng: number): number {
        if (lng < -180) {
            return lng + 360;
        }
        if (lng >= 180) {
            return lng - 360;
        }
        return lng;
    }

    /**
     * Convert a pixel point into coordinates
     * @param point pixel point to convert
     * @param wrapLng whether to clamp the longitude into -180 <= lng < 180
     */
    public fromPointToLatLng(point: Point, wrapLng = true): LatLng {
        // calculate longitude
        let lng = (point.x - this.pixelOrigin.x) / this.pixelsPerLonDegree;
        if (wrapLng) {
            lng = MercatorProjection.clampLng(lng);
        }

        // calculate latitude
        const latRadians = (point.y - this.pixelOrigin.y) / -this.pixelsPerLonRadian;
        const lat = MercatorProjection.radiansToDegrees((2 * Math.atan(Math.exp(latRadians))) - (Math.PI / 2));

        return { lat, lng };
    }

    public fromLatLngToPoint(latLng: LatLng): Point {
        // calculate x-axis pixel
        const x = this.pixelOrigin.x + (latLng.lng * this.pixelsPerLonDegree);

        // calculate y-axis pixel. Truncating to ALMOST_ONE (~0.9999) effectively limits
        // latitude to 89.189. This is about a third of a tile past the edge of the world tile.
        const siny = clamp(Math.sin(MercatorProjection.degreesToRadians(latLng.lat)), -ALMOST_ONE, ALMOST_ONE);
        const y = this.pixelOrigin.y + (0.5 * Math.log((1 + siny) / (1 - siny)) * -this.pixelsPerLonRadian);

        return { x, y };
    }
}

export default new MercatorProjection(256);
