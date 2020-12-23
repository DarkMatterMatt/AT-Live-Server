/*
 * Code TypeScriptified from source provided by Lachlan Davidson (github.com/lachlan2k)
 */

/**
 * Return distance**2 between two points.
 */
function getDistSquared(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return (dx * dx) + (dy * dy);
}

/**
 * Check if point is off the left or right side of the line
 * @param line two points that form a line
 * @param point target point
 */
function pointIsOutOfBounds(line: [Point, Point], point: Point): boolean {
    const [a, b] = line;

    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);

    return point.x < xMin || xMax < point.x;
}

/**
 * Find position on line that is closest to specified point.
 * @param line two points that form a line
 * @param point target point
 */
function projectPointOnLine(line: [Point, Point], point: Point): Point {
    const [a, b] = line;
    const targetLineM = (b.y - a.y) / (b.x - a.x);
    const targetLineC = a.y - (targetLineM * a.x);

    const projectionLineM = -1.0 / targetLineM;
    const projectionLineC = point.y - (projectionLineM * point.x);

    const intersectX = (targetLineC - projectionLineC) / (projectionLineM - targetLineM);
    const intersectY = (targetLineM * intersectX) + targetLineC;

    return {
        x: intersectX,
        y: intersectY,
    };
}

/**
 * Find position on either side of anchor point in path, that is closest to specified point.
 * If multiple vertices are equidistant, return vertex with lower index.
 * @param path path to find closest position on
 * @param anchor index of anchor point
 * @param point target point
 * @returns closestPosition
 */
function projectPointOnPath(path: Point[], anchor: number, point: Point): Point {
    if (anchor === 0) {
        const line: [Point, Point] = [path[0], path[1]];
        const intersectPoint = projectPointOnLine(line, point);

        // it's behind the path, limit to the start
        if (pointIsOutOfBounds(line, intersectPoint)) {
            return path[0];
        }
        return intersectPoint;
    }

    if (anchor === path.length - 1) {
        const line: [Point, Point] = [path[path.length - 1], path[path.length - 2]];
        const intersectPoint = projectPointOnLine(line, point);

        // it's past the end of the path, limit to the end
        if (pointIsOutOfBounds(line, intersectPoint)) {
            return path[path.length - 1];
        }
        return intersectPoint;
    }

    const candidateA: [Point, Point] = [path[anchor - 1], path[anchor]];
    const candidateB: [Point, Point] = [path[anchor], path[anchor + 1]];

    const aIntersect = projectPointOnLine(candidateA, point);
    const bIntersect = projectPointOnLine(candidateB, point);

    const aIsOOB = pointIsOutOfBounds(candidateA, aIntersect);
    const bIsOOB = pointIsOutOfBounds(candidateB, bIntersect);

    if (aIsOOB && bIsOOB) {
        // anchor is closest
        return path[anchor];
    }
    if (aIsOOB) {
        return bIntersect;
    }
    if (bIsOOB) {
        return aIntersect;
    }

    const aDist = getDistSquared(point, aIntersect);
    const bDist = getDistSquared(point, bIntersect);

    if (aDist <= bDist) {
        return aIntersect;
    }
    return bIntersect;
}

/**
 * Find vertex on path that is closest to specified point.
 * If multiple vertices are equidistant, return vertex with lower index.
 * @param path polyline to search for close vertex
 * @param point target point
 * @returns index of closest point
 */
function getClosestPoint(path: Point[], point: Point): number {
    let minDistance = Infinity;
    let minIndex = -1;

    for (let i = 0; i < path.length; i++) {
        const dist = getDistSquared(point, path[i]);
        if (dist < minDistance) {
            minDistance = dist;
            minIndex = i;
        }
    }
    return minIndex;
}

/**
 * Find vertex on path that is closest to specified point.
 * @param path polyline to search for close vertex
 * @param point target point
 * @returns closestPosition
 */
export function getClosestPointOnPath(path: Point[], point: Point): Point {
    const anchor = getClosestPoint(path, point);
    return projectPointOnPath(path, anchor, point);
}