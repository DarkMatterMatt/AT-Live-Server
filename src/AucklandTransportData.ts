import fetch from "node-fetch";
import pLimit, { Limit } from "p-limit";
import { performance } from "perf_hooks";
import simplify from "simplify-js";
import spacetime from "spacetime";
import { ATWebSocket, convertATShapePointRawToLatLngs, convertATVehicleRawToATVehicleUnprocessed, convertATVehicleToOutputVehicle, convertLatLngsToPolylineLatLngPixels, convertLatLngsToPolylinePoints, isATVehicleRaw } from "~/aucklandTransport";
import { processVehicle } from "./aucklandTransport/vehicle";
import Cache from "./Cache";
import { map } from "./helpers";
import logger from "./logger";

const WS_CODE_CLOSE_PLANNED_SHUTDOWN = 4000;
const WS_CODE_CLOSE_NO_RECONNECT = 4001;
const SLEEP_BEFORE_WS_RECONNECT_503 = 500;
const SLEEP_BEFORE_WS_RECONNECT_502 = 60 * 1000;
const SLEEP_BEFORE_WS_RECONNECT_GENERIC = 500;
const LOOK_FOR_UPDATES_INTERVAL = 5 * 60 * 1000;
const REMOVE_OLD_VEHICLE_INTERVAL = 10 * 1000;
const WS_HEALTH_CHECK_INTERVAL = 120 * 1000;
const WS_HEALTHY_IF_MESSAGE_WITHIN = 15 * 1000;
const OLD_VEHICLE_THRESHOLD = 120 * 1000;
const DEFAULT_LIVE_POLLING_INTERVAL = 25 * 1000;
const POLYLINE_SIMPLIFICATION = 0.000005; // simplify-js epsilon

// https://developers.google.com/transit/gtfs/reference#routestxt
const TRANSIT_TYPES = ["tram", "subway", "rail", "bus", "ferry"];

class AucklandTransportData {
    private output: Output;
    private _key: string;
    private _baseUrl: string;
    private _webSocketUrl: string;
    private _allVersions: Map<string, ATVersion>;
    private _currentVersions: string[];
    private _cache: Cache;
    private _pLimit: Limit;
    private ws: ATWebSocket;
    private _lastMessageTimestamp: number;
    private _livePollingInterval: null | ReturnType<typeof setInterval> = null;
    private _livePollingIntervalSetting: number;
    private _byShortName = new Map<string, ATRoute>();
    private _byRouteId = new Map<string, ATRoute>();
    private _autoUpdateInterval: null | ReturnType<typeof setInterval> = null;
    private _removeOldVehiclesInterval: null | ReturnType<typeof setInterval> = null;

    constructor({
        key,
        baseUrl,
        webSocketUrl,
        maxCacheSizeInBytes,
        compressCache,
        maxParallelRequests = 10,
        livePollingInterval: livePollingIntervalSetting = DEFAULT_LIVE_POLLING_INTERVAL,
    }: AucklandTransportDataOpts, output: Output) {
        if (!key) throw new Error("AucklandTransportData: Missing API key");
        if (!baseUrl) throw new Error("AucklandTransportData: Missing API URL");
        if (!webSocketUrl) throw new Error("AucklandTransportData: Missing WebSocket URL");

        this.output = output;
        this._key = key;
        this._baseUrl = baseUrl;
        this._webSocketUrl = webSocketUrl;
        this._allVersions = new Map();
        this._currentVersions = [];
        this._cache = new Cache("ATCache", maxCacheSizeInBytes, compressCache);
        this._pLimit = pLimit(maxParallelRequests);
        this._lastMessageTimestamp = 0;

        // websocket is buggy, poll manually every LIVE_POLLING_INTERVAL if it isn't working
        this._livePollingIntervalSetting = livePollingIntervalSetting;
    }

    clearCache() {
        this._cache.clear();
    }

    getRoutesByShortName() {
        return this._byShortName;
    }

    getRouteByShortName(shortName: string) {
        return this._byShortName.get(shortName);
    }

    hasRouteByShortName(shortName: string) {
        return this._byShortName.get(shortName);
    }

    webSocketActive() {
        return this.ws.isActive();
    }

    livePollingActive() {
        return this._livePollingInterval !== null;
    }

    lastMessageTimestamp() {
        return this._lastMessageTimestamp;
    }

    async query(url: string, noCache?: "noCache") {
        if (noCache !== "noCache") {
            const cachedData = this._cache.load(url);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        const result = await this._pLimit(() => fetch(this._baseUrl + url, {
            headers: { "Ocp-Apim-Subscription-Key": this._key },
        })).then(r => r.json());

        if (result.status !== "OK") {
            logger.error(`Failed fetching ${url}:`, result);
            throw new Error(`Failed fetching ${url}: ${result.error || result.message}`);
        }

        if (noCache !== "noCache") {
            this._cache.store(url, result.response);
        }
        return result.response;
    }

    async queryLatestVersion() {
        const response = (await this.query("gtfs/versions", "noCache")) as ATVersionRaw[];
        for (const v of response) {
            this._allVersions.set(v.version, v);
        }

        // note1: AT does this weird thing where a version will end at midnight
        //   on a day, but the next one technically doesn't kick in till the
        //   next day. (e.g. ends at 0am on Monday, starts at 0am Tuesday)
        //   -> workaround: add one day to the end time
        // note2: AT displays times as UTC but they are actually local (NZ) time
        //   -> workaround: completely remove the time and timezone (only use the date, as NZ time)
        // note3: Late buses (e.g. 1am, 2am, 3am) still run on the previous day's route
        //   -> workaround: allow multiple versions to be considered 'active' at once
        // note4: AT removes routes that have expired, even when buses are still using them (note3)
        //   -> workaround: store our own array, _allVersions, of the versions we see
        const now = spacetime.now();
        const filtered = [...this._allVersions.values()].filter(v => {
            const start = spacetime(v.startdate.split("T")[0], "Pacific/Auckland", { dmy: true })
                .subtract(1, "day");
            const end = spacetime(v.enddate.split("T")[0], "Pacific/Auckland", { dmy: true })
                .add(2, "day");
            return now.isBetween(start, end, true);
        });
        if (filtered.length === 0) {
            logger.error("No versions are currently active @", now.format("nice"), [...this._allVersions.values()]);
        }
        this._currentVersions = filtered.map(v => v.version).sort();
        return this._currentVersions;
    }

    isCurrentVersion(id: string) {
        // return true if id ends with any current version
        if (this._currentVersions.length === 0) {
            return true;
        }
        return this._currentVersions.some(v => id.endsWith(v));
    }

    removeOldVehicles() {
        const now = Date.now();
        this._byShortName.forEach(processedRoute => {
            processedRoute.vehicles.forEach((processedVehicle, vehicleId) => {
                // remove vehicles more than 2 mins old
                if (processedVehicle.lastUpdated < now - OLD_VEHICLE_THRESHOLD) {
                    processedRoute.vehicles.delete(vehicleId);
                }
            });
        });
    }

    loadVehiclePosition(unprocessedVehicle: ATVehicleUnprocessed): boolean {
        // ignore vehicles more than 2 minutes old
        if (unprocessedVehicle.lastUpdatedUnix * 1000 < Date.now() - OLD_VEHICLE_THRESHOLD) return false;

        const { vehicle, route } = processVehicle(this._byRouteId, unprocessedVehicle);
        if (vehicle == null) {
            return false;
        }

        route.vehicles.set(vehicle.vehicleId, vehicle);
        const outputVehicle = convertATVehicleToOutputVehicle(route, vehicle);
        this.output.publish(route.shortName, outputVehicle);

        return true;
    }

    async loadAllVehiclePositions(): Promise<number> {
        const response: {
            entity: {
                id: string;
                is_deleted: boolean;
                vehicle: ATVehicleRaw;
            }[];
        } = await this.query("public/realtime/vehiclelocations", "noCache");
        // return number of new vehicle updates
        let numVehiclesUpdated = 0;
        for (const vehicle of response.entity) {
            if (isATVehicleRaw(vehicle)) {
                const updateHappened = this.loadVehiclePosition(convertATVehicleRawToATVehicleUnprocessed(vehicle));
                if (updateHappened) {
                    numVehiclesUpdated += 1;
                }
            }
        }
        return numVehiclesUpdated;
    }

    startWebSocket() {
        this.ws = new ATWebSocket({
            url: this._webSocketUrl + this._key,
            onVehicleUpdate: vehicle => {
                this.loadVehiclePosition(vehicle);
            },
            onDisconnect: () => {
                logger.info("ATWebSocket onDisconnect");
                this.startLivePolling();
            },
            onConnect: () => {
                logger.info("ATWebSocket onConnect");
                this.stopLivePolling();
            },
        });
    }

    private startLivePolling(): void {
        clearInterval(this._livePollingInterval);
        this._livePollingInterval = setInterval(
            () => this.loadAllVehiclePositions(),
            this._livePollingIntervalSetting
        );
    }

    private stopLivePolling(): void {
        clearInterval(this._livePollingInterval);
        this._livePollingInterval = null;
    }

    stopWebSocket() {
        this.ws.destroy(WS_CODE_CLOSE_PLANNED_SHUTDOWN);
    }

    async load() {
        const startTime = performance.now();

        // routes are required to look up short names
        const routes = (await this.query("gtfs/routes", "noCache")) as ATRouteRaw[];
        const filteredRoutes = routes.filter(r => this.isCurrentVersion(r.route_id));
        for (const route of filteredRoutes) {
            const shortName = route.route_short_name;
            if (!this._byShortName.has(shortName)) {
                this._byShortName.set(shortName, {
                    shortName,
                    routeIds: new Set(),
                    shapeIds: [new Map(), new Map()],
                    longNames: new Set(),
                    longName: "",
                    polylines: [[], []],
                    vehicles: new Map(),
                    type: TRANSIT_TYPES[route.route_type] as TransitType,
                    agencyId: route.agency_id,
                });
            }
            const processedRoute = this._byShortName.get(shortName);
            this._byRouteId.set(route.route_id, processedRoute);
            processedRoute.routeIds.add(route.route_id);
            processedRoute.longNames.add(route.route_long_name);
        }

        // trips are required for fetching shapes
        const trips = (await this.query("gtfs/trips", "noCache")) as ATTripRaw[];
        const filteredTrips = trips.filter(t => this.isCurrentVersion(t.trip_id));
        for (const trip of filteredTrips) {
            const shapesMap = this._byRouteId.get(trip.route_id).shapeIds[trip.direction_id];
            const count = shapesMap.get(trip.shape_id) || 0;
            shapesMap.set(trip.shape_id, count + 1);
        }

        // select longName, get polylines from shapeIds
        await Promise.allSettled(Array.from(this._byShortName, async ([_, processedRoute]) => {
            /* eslint-disable no-param-reassign, no-await-in-loop */
            const longNames = [...processedRoute.longNames];
            // sort by length, then alphabetically
            longNames.sort((a, b) => (b.length - a.length || (a > b ? 1 : -1)));
            // make To and Via lowercase, remove full stops
            processedRoute.longName = longNames[0]
                .replace(/To/g, "to")
                .replace(/Via/g, "via")
                .replace(/\./g, "");

            // sort longNames, routeIds for consistency in the API
            processedRoute.longNames = new Set(longNames.sort((a, b) => a.localeCompare(b)));
            processedRoute.routeIds = new Set([...processedRoute.routeIds].sort((a, b) => a.localeCompare(b)));

            for (let i = 0; i < 2; i++) {
                if (processedRoute.shapeIds[i].size === 0) {
                    processedRoute.polylines[i] = [];
                    continue;
                }
                // fetch shapes for the most common routes
                const shapeIds = [...processedRoute.shapeIds[i]];
                const shapes = await map(shapeIds,
                    a => this.query(`gtfs/shapes/shapeId/${a[0]}`) as Promise<ATShapePointRaw[]>);
                const polylines = shapes
                    .map(p => convertATShapePointRawToLatLngs(p))
                    .map(l => convertLatLngsToPolylinePoints(l));
                // we'll use the longest shape (simplified so Google Maps doesn't die)
                const [polyline] = polylines.sort((a, b) => b[b.length - 1].dist - a[a.length - 1].dist);
                const simplifiedShape = simplify(
                    polyline.map(p => ({ x: p.lat, y: p.lng })), POLYLINE_SIMPLIFICATION, true
                ).map(p => ({ lat: p.x, lng: p.y }));

                processedRoute.polylines[i] = convertLatLngsToPolylineLatLngPixels(simplifiedShape);

                // sort shapeIds for consistency in the API
                processedRoute.shapeIds[i] = new Map(shapeIds.sort((a, b) => a[0].localeCompare(b[0])));
            }
        }));

        await this.loadAllVehiclePositions();

        logger.debug("load", "performance (ms)", performance.now() - startTime);
    }

    async lookForUpdates(forceLoad?: "forceLoad") {
        const cachedVersion = this._cache.load("latest-version");
        await this.queryLatestVersion();
        if (this._currentVersions.length && JSON.stringify(cachedVersion) !== JSON.stringify(this._currentVersions)) {
            this._cache.store("latest-version", this._currentVersions);
            await this.load();
        }
        else if (forceLoad === "forceLoad") {
            await this.load();
        }
    }

    startAutoUpdates() {
        this._autoUpdateInterval = setInterval(() => this.lookForUpdates(), LOOK_FOR_UPDATES_INTERVAL);
        this._removeOldVehiclesInterval = setInterval(() => this.removeOldVehicles(), REMOVE_OLD_VEHICLE_INTERVAL);
        this.startLivePolling();
        this.startWebSocket();
    }

    stopAutoUpdates() {
        clearInterval(this._autoUpdateInterval);
        clearInterval(this._removeOldVehiclesInterval);
        this.stopWebSocket();
        this.stopLivePolling();
    }
}

export default AucklandTransportData;
