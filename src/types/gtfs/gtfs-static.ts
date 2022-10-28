import type { LatLng, Point } from "../";

export interface ShapeLatLng extends LatLng {
    dist: number;
}

export interface ShapePoint extends ShapeLatLng, Point {}
