import logger from "~/logger";
import { toLatLng } from "./normalizers";
import { snapVehicleToPolyline } from "./snap";

interface ProcessVehicleResultError {
    vehicle: null,
    route: ATRoute | null,
}

interface ProcessVehicleResultSuccess {
    vehicle: ATVehicle,
    route: ATRoute,
}

type ProcessVehicleResult = ProcessVehicleResultError | ProcessVehicleResultSuccess;

export function processVehicle(routesById: Map<string, ATRoute>, vehicle: ATVehicleUnprocessed): ProcessVehicleResult {
    const route = routesById.get(vehicle.routeId);
    if (route == null) {
        // usually because the vehicle is operating off an old route version
        logger.warn("Skipping vehicle update because its parent route does not exist!", { vehicle });
        return { vehicle: null, route: null };
    }

    const lastUpdated = vehicle.lastUpdatedUnix * 1000;

    const old = route.vehicles.get(vehicle.vehicleId);
    if (old != null && old.lastUpdated > lastUpdated) {
        // old vehicle is newer than new vehicle
        return { vehicle: null, route };
    }

    const {
        snapPosition,
        snapDist,
        snapBearing,
    } = snapVehicleToPolyline(route.polylines[vehicle.directionId], vehicle.position);

    const processed: ATVehicle = {
        bearing: vehicle.bearing,
        routeId: vehicle.routeId,
        directionId: vehicle.directionId,
        lastUpdated,
        position: vehicle.position,
        vehicleId: vehicle.vehicleId,
        occupancyStatus: vehicle.occupancyStatus,
        snapPosition: toLatLng(snapPosition),
        snapDeviation: snapDist,
        snapBearing,
    };

    return {
        vehicle: processed,
        route,
    };
}
