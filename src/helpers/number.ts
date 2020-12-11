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
