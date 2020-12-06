import fetch from "node-fetch";
import pLimit, { Limit } from "p-limit";
import simplify from "simplify-js";
import spacetime from "spacetime";
import { TemplatedApp } from "uWebSockets.js";
import WebSocket from "ws";
import { convertATVehicleRawToATVehicle, isATVehicleRaw, isATVehicleRawWS } from "./aucklandTransport";
import Cache from "./Cache";
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
    private _uWSApp: TemplatedApp;
    private _key: string;
    private _baseUrl: string;
    private _webSocketUrl: string;
    private _allVersions: Map<string, ATVersion>;
    private _currentVersions: string[];
    private _cache: Cache;
    private _pLimit: Limit;
    private _ws: WebSocket;
    private _lastMessageTimestamp: number;
    private _restartWebSocketTimeout: null | ReturnType<typeof setTimeout>;
    private _livePollingInterval: null | ReturnType<typeof setInterval>;
    private _livePollingIntervalSetting: number;
    private _webSocketHealthLastCheck: number;
    private _webSocketMonitorInterval: ReturnType<typeof setInterval>;
    private _byShortName: Map<string, ATRoute>;
    private _byRouteId: Map<string, ATRoute>;
    private _autoUpdateInterval: null | ReturnType<typeof setInterval>;
    private _removeOldVehiclesInterval: null | ReturnType<typeof setInterval>;

    constructor({
        key,
        baseUrl,
        webSocketUrl,
        maxCacheSizeInBytes,
        compressCache,
        maxParallelRequests = 10,
        livePollingInterval: livePollingIntervalSetting = DEFAULT_LIVE_POLLING_INTERVAL,
    }: AucklandTransportDataOpts, uWSApp: TemplatedApp) {
        if (!key) throw new Error("AucklandTransportData: Missing API key");
        if (!baseUrl) throw new Error("AucklandTransportData: Missing API URL");
        if (!webSocketUrl) throw new Error("AucklandTransportData: Missing WebSocket URL");

        this._uWSApp = uWSApp;
        this._key = key;
        this._baseUrl = baseUrl;
        this._webSocketUrl = webSocketUrl;
        this._allVersions = new Map();
        this._currentVersions = [];
        this._cache = new Cache("ATCache", maxCacheSizeInBytes, compressCache);
        this._pLimit = pLimit(maxParallelRequests);
        this._ws = null;
        this._lastMessageTimestamp = 0;

        // when the websocket breaks we'll try reconnect
        this._restartWebSocketTimeout = null;

        // websocket is buggy, poll manually every LIVE_POLLING_INTERVAL if it isn't working
        this._livePollingInterval = null;
        this._livePollingIntervalSetting = livePollingIntervalSetting;

        // check websocket is working if it hasn't recieved anything for two minutes
        this._webSocketHealthLastCheck = Date.now();
        this._webSocketMonitorInterval = setInterval(() => this.checkWebSocketHealth(), 1000);

        /* Processed data by short name
            {
                shortName: {
                    shortName,
                    longNames: Set(),
                    longName,
                    routeIds:  Set(routeId),
                    shapeIds:  [new Map<shapeId, count>(), new Map<shapeId, count>()],
                    polylines: [[{ lat, lng }], [{ lat, lng }]],
                    vehicles:  Map(vehicleId: {
                        vehicleId,
                        lastUpdatedUnix,
                        directionId,
                        position: { lat, lng },
                    }),
                    type: one of ["rail", "bus", "ferry"]
                    agencyId
                }
            }
        */
        this._byShortName = new Map();

        /* Links to _byShortName */
        this._byRouteId = new Map();
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
        return this._ws !== null;
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
                if (processedVehicle.lastUpdatedUnix * 1000 < now - OLD_VEHICLE_THRESHOLD) {
                    processedRoute.vehicles.delete(vehicleId);
                }
            });
        });
    }

    loadVehiclePosition(data: ATVehicleRaw | ATVehicleRawWS) {
        const vehicle = convertATVehicleRawToATVehicle(data);

        // ignore vehicles more than 2 minutes old
        if (vehicle.lastUpdatedUnix * 1000 < Date.now() - OLD_VEHICLE_THRESHOLD) return false;

        const route = this._byRouteId.get(vehicle.routeId);
        if (route === undefined) {
            // usually because the vehicle is operating off an old route version
            logger.warn("Skipping vehicle update because its parent route does not exist!", { vehicle });
            return false;
        }

        const old = route.vehicles.get(vehicle.vehicleId);

        if (old === undefined || old.lastUpdatedUnix !== vehicle.lastUpdatedUnix) {
            route.vehicles.set(vehicle.vehicleId, vehicle);
            this._uWSApp.publish(route.shortName, JSON.stringify({
                ...vehicle,
                status:    "success",
                route:     "live/vehicle", // websocket JSON route, not the vehicle's transit route
                shortName: route.shortName,
            }));
        }
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
                const updateHappened = this.loadVehiclePosition(vehicle);
                if (updateHappened) {
                    numVehiclesUpdated += 1;
                }
            }
        }
        return numVehiclesUpdated;
    }

    async checkWebSocketHealth() {
        if (this._ws === null) return;
        const now = Date.now();
        if (this._webSocketHealthLastCheck > now - WS_HEALTH_CHECK_INTERVAL) return;
        if (this._lastMessageTimestamp * 1000 > now - WS_HEALTHY_IF_MESSAGE_WITHIN) return;
        this._webSocketHealthLastCheck = now;

        // check if there are new vehicles that the websocket didn't know about
        if (await this.loadAllVehiclePositions() > 0) {
            logger.warn("WebSocket wasn't recieving vehicle updates, force restarting it now");
            this.forceRestartWebSocket();
        }
    }

    restartWebSocketIn(ms: number) {
        if (this._restartWebSocketTimeout === null) {
            this._restartWebSocketTimeout = setTimeout(() => this.startWebSocket(), ms);
        }
    }

    forceRestartWebSocket() {
        if (this._ws !== null && this._ws.readyState === this._ws.OPEN) {
            this._ws.close(WS_CODE_CLOSE_NO_RECONNECT);
        }
        this.restartWebSocketIn(100);
    }

    startWebSocket() {
        // shouldn't need to clear it, as this function should be the timeout's callback
        clearTimeout(this._restartWebSocketTimeout);
        this._restartWebSocketTimeout = null;

        if (this._livePollingInterval === null) {
            this._livePollingInterval = setInterval(
                () => this.loadAllVehiclePositions(),
                this._livePollingIntervalSetting
            );
        }

        this._ws = new WebSocket(this._webSocketUrl + this._key);
        this._ws.on("open", () => {
            this._ws.send(JSON.stringify({
                // appears to be a stripped-down GraphQL API
                filters: { "vehicle.trip.scheduleRelationship": ["SCHEDULED"] },
                query:   `{ vehicle {
                    vehicle { id }
                    trip { routeId directionId }
                    position { latitude longitude }
                    timestamp
                    occupancyStatus
                } }`,
            }));
        });

        this._ws.on("message", (data_: string) => {
            // websocket is working, stop polling for data
            clearInterval(this._livePollingInterval);
            this._livePollingInterval = null;

            const data = JSON.parse(data_).vehicle;
            if (!data) return;

            if (data.timestamp > this._lastMessageTimestamp) {
                this._lastMessageTimestamp = data.timestamp;
            }

            if (isATVehicleRawWS(data)) {
                this.loadVehiclePosition(data);
            }
        });

        this._ws.on("error", (err: Error) => {
            // HTTP errors (only while connecting?)
            // buggy AT server returns 503 (AKA retry cause it's only
            // temporarily broken), and has been known to break badly and
            // 502 (this is kinda perma-broken, wait a bit before reconnecting)
            if (err.message === "Unexpected server response: 503") {
                logger.warn(`WebSocket returned error 503, retrying in ${SLEEP_BEFORE_WS_RECONNECT_503}ms`);
                this.restartWebSocketIn(SLEEP_BEFORE_WS_RECONNECT_503);
                return;
            }
            if (err.message === "Unexpected server response: 502") {
                logger.warn(`WebSocket returned error 502, retrying in ${SLEEP_BEFORE_WS_RECONNECT_502}ms`);
                this.restartWebSocketIn(SLEEP_BEFORE_WS_RECONNECT_502);
                return;
            }
            throw err;
        });

        this._ws.on("close", (code: number) => {
            this._ws = null;

            if (code === WS_CODE_CLOSE_PLANNED_SHUTDOWN) {
                // planned closure, requested internally
                logger.verbose("WebSocket closed as part of a planned shutdown.");
                return;
            }

            if (code === WS_CODE_CLOSE_NO_RECONNECT) {
                // most likely reconnecting from somewhere else
                logger.verbose("WebSocket close with code: WS_CODE_CLOSE_NO_RECONNECT");
                return;
            }

            if (code === 1006) {
                // abnormal closure, restart the websocket
                // (error handler may have already set restartWebSocketTimeout)
                if (this._restartWebSocketTimeout === null) {
                    logger.warn(`WebSocket closed unexpectedly, restarting in ${SLEEP_BEFORE_WS_RECONNECT_GENERIC}ms`);
                    this.restartWebSocketIn(SLEEP_BEFORE_WS_RECONNECT_GENERIC);
                }
                return;
            }

            throw new Error(`Unknown close code: ${code}`);
        });
    }

    stopWebSocket() {
        if (this._ws !== null) {
            this._ws.close(WS_CODE_CLOSE_PLANNED_SHUTDOWN);
        }
    }

    async load() {
        // routes are required to look up short names
        const routes = (await this.query("gtfs/routes", "noCache")) as ATRouteRaw[];
        const filteredRoutes = routes.filter(r => this.isCurrentVersion(r.route_id));
        for (const route of filteredRoutes) {
            const shortName = route.route_short_name;
            if (!this._byShortName.has(shortName)) {
                this._byShortName.set(shortName, {
                    shortName,
                    routeIds:  new Set(),
                    shapeIds:  [new Map(), new Map()],
                    longNames: new Set(),
                    longName:  "",
                    polylines: [[], []],
                    vehicles:  new Map(),
                    type:      TRANSIT_TYPES[route.route_type] as TransitType,
                    agencyId:  route.agency_id,
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
                const highestCount = Math.max(...shapeIds.map(a => a[1]));
                const shapes = await Promise.all(
                    shapeIds.filter(a => a[1] > highestCount * 0.75)
                        .map(a => (this.query(`gtfs/shapes/shapeId/${a[0]}`) as Promise<ATShapePointRaw[]>))
                );
                // generate polyline for the longest shape (simplified so Google Maps doesn't die)
                const [shape] = shapes.sort((a, b) => b.length - a.length);
                const simplifiedShape = simplify(
                    shape.map(s => ({ x: s.shape_pt_lat, y: s.shape_pt_lon })), POLYLINE_SIMPLIFICATION, true
                );
                processedRoute.polylines[i] = simplifiedShape.map(s => ({ lat: s.x, lng: s.y }));

                // sort shapeIds for consistency in the API
                processedRoute.shapeIds[i] = new Map(shapeIds.sort((a, b) => a[0].localeCompare(b[0])));
            }
        }));

        await this.loadAllVehiclePositions();
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
        this.startWebSocket();
    }

    stopAutoUpdates() {
        clearInterval(this._autoUpdateInterval);
        clearInterval(this._removeOldVehiclesInterval);
        this.stopWebSocket();
    }
}

export default AucklandTransportData;
