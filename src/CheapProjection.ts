import { mercatorProjection } from "./MercatorProjection";

export default class CheapProjection implements MapProjection {
    private center: LatLng;
    private centerPt: Point;
    private radius: number;

    private metersPerPx: number;
    private metersPerLat: number;
    private metersPerLng: number;
    private pxPerLat: number;
    private pxPerLng: number;

    /**
     * Create a projection optimised for a specific region.
     * @param center CheapProjection will be most accurate at this location
     * @param radius radius in meters
     */
    public constructor(center: LatLng, radius: number) {
        this.center = center;
        this.radius = radius;

        const centerPt = mercatorProjection.fromLatLngToPoint(center);
        this.centerPt = centerPt;
        this.metersPerPx = mercatorProjection.getMetersPerPixel(center.lat);

        const pxOffset = radius / this.metersPerPx;
        const latN = mercatorProjection.fromPointToLatLng({ x: centerPt.x, y: centerPt.y + pxOffset }).lat;
        const latS = mercatorProjection.fromPointToLatLng({ x: centerPt.x, y: centerPt.y - pxOffset }).lat;
        const lngE = mercatorProjection.fromPointToLatLng({ x: centerPt.x + pxOffset, y: centerPt.y }).lng;
        const lngW = mercatorProjection.fromPointToLatLng({ x: centerPt.x - pxOffset, y: centerPt.y }).lng;

        this.metersPerLat = 2 * radius / (latN - latS);
        this.metersPerLng = 2 * radius / (lngE - lngW);
        this.pxPerLat = 2 * pxOffset / (latN - latS);
        this.pxPerLng = 2 * pxOffset / (lngE - lngW);
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
        const dx = point.x - this.centerPt.x;
        const dy = point.y - this.centerPt.y;
        const lng = this.center.lng + (dx / this.pxPerLng);
        const lat = this.center.lat + (dy / this.pxPerLat);
        return {
            lat,
            lng: wrapLng ? CheapProjection.clampLng(lng) : lng,
        };
    }

    /**
     * Convert coordinates into a pixel point
     * @param latLng coordinates to convert
     */
    public fromLatLngToPoint(latLng: LatLng): Point {
        const dLng = latLng.lng - this.center.lng;
        const dLat = latLng.lat - this.center.lat;
        const x = this.centerPt.x + (dLng * this.pxPerLng);
        const y = this.centerPt.y + (dLat * this.pxPerLat);
        return { x, y };
    }
}

export const AUCKLAND_COORDINATES = {
    lat: -36.884735,
    lng: -185.241414,
};
export const aucklandProjection = new CheapProjection(AUCKLAND_COORDINATES, 25 * 1000);

