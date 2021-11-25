import type { TripUpdate, VehicleUpdate } from "gtfs-types";
import type { LatLng } from ".";

/**
 * Globally unique region code.
 *
 * Format is COUNTRY_REGION. COUNTRY is an ISO 3166-1 alpha-3 code; REGION is a string.
 */
export type RegionCode = `${string}_${string}`;

export type TripUpdateListener = (update: TripUpdate) => void;

export type VehicleUpdateListener = (update: VehicleUpdate) => void;

/**
 * Represents a datasource for a single region.
 */
export interface DataSource {
    /**
     * Globally unique region code.
     *
     * Format is COUNTRY_REGION. COUNTRY is an ISO 3166-1 alpha-3 code; REGION is a string.
     */
    readonly code: RegionCode;

    /**
     * Returns true if an update was processed. Should be called regularly.
     */
    checkForRealtimeUpdate: () => Promise<boolean>;

    /**
     * Returns true if an update was processed. Should be called regularly.
     */
    checkForStaticUpdate: () => Promise<boolean>;

    /**
     * Returns an appropriate long name for the given short name.
     *
     * Selects the longest name (prefer more detailed names), breaks ties by lexicographical order.
     */
    getLongNameByShortName(shortName: string): Promise<string>;

    /**
     * Returns two polyline shapes, one for each direction.
     *
     * Selects the longest shape (by distance), breaks ties by version number.
     * Returns an empty shape if there is no shape for the specified direction/short name.
     */
    getShapesByShortName: (shortName: string) => Promise<[LatLng[], LatLng[]]>;

    /**
     * Return short name for specified trip id.
     */
    getShortNameByTripId: (tripId: string) => Promise<string>;

    /**
     * Return trip id for specified route, direction, and start time.
     */
    getTripIdByTripDetails: (routeId: string, directionId: number, startTime: string) => Promise<string>;

    /**
     * Returns a map of realtime trip updates, keyed by `trip_id`.
     *
     * The map will contain the most recent update for each trip, but is not required to
     * contain updates older than two minutes.
     */
    getTripUpdates: () => Promise<ReadonlyMap<string, VehicleUpdate>>;

    /**
     * Returns a map of realtime vehicle updates, keyed by `vehicle_id`.
     *
     * The list will contain the most recent update for each vehicle, but is not required to
     * contain updates older than two minutes.
     */
    getVehicleUpdates: () => Promise<ReadonlyMap<string, VehicleUpdate>>;

    /**
     * Will be executed once on startup.
     */
    initialize: (tempDir: string) => Promise<void>;

    /**
     * Register a function to be called when an update is available.
     */
    registerTripUpdateListener: (listener: TripUpdateListener) => void;

    /**
     * Register a function to be called when an update is available.
     */
    registerVehicleUpdateListener: (listener: VehicleUpdateListener) => void;
}
