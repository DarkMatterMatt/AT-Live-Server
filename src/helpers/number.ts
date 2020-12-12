/**
 * Clamp a value into a range, such that min <= result <= max.
 * @param val value to clamp into a range
 * @param min minimum value to be returned
 * @param max maximum value to be returned
 */
export function clamp(val: number, min: number | null, max: number | null): number {
    if (min != null && val < min) {
        return max;
    }
    if (max != null && val > max) {
        return max;
    }
    return val;
}

/**
 * Convert angle in degrees to radians.
 */
export function degreesToRadians(deg: number): number {
    return deg * Math.PI / 180;
}

/**
 * Convert angle in radians to degrees.
 */
export function radiansToDegrees(rad: number): number {
    return 180 * rad / Math.PI;
}
