const fetch = require("node-fetch");
const pLimit = require("p-limit");
const WebSocket = require("ws");
const Cache = require("./Cache");

const SLEEP_BEFORE_WS_RECONNECT = 500;
const LOOK_FOR_UPDATES_INTERVAL = 5 * 60 * 1000;
const REMOVE_OLD_VEHICLE_INTERVAL = 10 * 1000;
const OLD_VEHICLE_THRESHOLD = 120 * 1000;
const API_KEY_LENGTH = 32;

class AucklandTransportData {
    constructor({ key, baseUrl, webSocketUrl, maxCacheSizeInBytes, compressCache, maxParallelRequests = 10 }, uWSApp) {
        if (!key) throw new Error("AucklandTransportData: Missing API key");
        if (!baseUrl) throw new Error("AucklandTransportData: Missing API URL");
        if (!webSocketUrl) throw new Error("AucklandTransportData: Missing WebSocket URL");

        this._uWSApp = uWSApp;
        this._key = key;
        this._baseUrl = baseUrl;
        this._webSocketUrl = webSocketUrl;
        this._version = "";
        this._cache = new Cache("ATCache", maxCacheSizeInBytes, compressCache);
        this._pLimit = pLimit(maxParallelRequests);
        this._ws = null;

        /* Processed data by short name
            {
                shortName: {
                    shortName,
                    routeIds: Set(routeId),
                    shapeIds: Set(shapeId),
                    polylines:   [[{ lat, lng }], [{ lat, lng }]],
                    vehicles: Map(vehicleId: {
                        vehicleId,
                        lastUpdatedUnix,
                        directionId,
                        position: { lat, lng },
                    }),
                }
            }
        */
        this._byShortName = new Map();

        /* Links to _byShortName */
        this._byRouteId = new Map();
    }

    /** Note: the server must be run in New Zealand */
    static _localIsoDate() {
        const d = new Date();
        const year = d.getFullYear();
        let month = d.getMonth() + 1;
        let day = d.getDate();
        if (month < 10) month = `0${month}`;
        if (day < 10) day = `0${day}`;
        return [year, month, day].join("-");
    }

    clearCache() {
        this._cache.clear();
    }

    getRouteByShortName(shortName) {
        return this._byShortName.get(shortName);
    }

    hasRouteByShortName(shortName) {
        return this._byShortName.get(shortName);
    }

    async query(url, noCache) {
        if (!noCache) {
            const cachedData = this._cache.load(url);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        const result = await this._pLimit(() => fetch(this._baseUrl + url, {
            headers: { "Ocp-Apim-Subscription-Key": this._key },
        })).then(r => r.json());

        if (result.status !== "OK") {
            console.error(`Failed fetching ${url}:`, result);
            throw new Error(`Failed fetching ${url}: ${result.error || result.message}`);
        }

        if (!noCache) {
            this._cache.store(url, result.response);
        }
        return result.response;
    }

    async queryLatestVersion() {
        const versions = await this.query("gtfs/versions", "noCache");

        // note: AT does this weird thing where a version will end at midnight on a day, but the next one
        //   technically doesn't kick in till the next day. (e.g. ends at 0am on Monday, starts at 0am Tuesday)
        // note2: AT displays times as UTC but they are actually local time
        const now = this.constructor._localIsoDate();
        const filtered = versions.filter(v => v.startdate.split("T")[0] <= now && now <= v.enddate.split("T")[0]);
        if (filtered.length === 0) {
            console.error("No versions are currently active", versions);
            this._version = "";
        }
        else {
            this._version = filtered[0].version;
        }
        return this._version;
    }

    async validateApiKey() {
        if (!this._apiKey || this._apiKey.length !== API_KEY_LENGTH) {
            return false;
        }
        try {
            await this.getLatestVersion();
            return true;
        }
        catch (err) {
            return false;
        }
    }

    removeOldVehicles() {
        const now = (new Date()).getTime();
        this._byShortName.forEach(processedRoute => {
            processedRoute.vehicles.forEach((processedVehicle, vehicleId) => {
                // remove vehicles more than 2 mins old
                if (processedVehicle.lastUpdatedUnix * 1000 < now - OLD_VEHICLE_THRESHOLD) {
                    processedRoute.vehicles.delete(vehicleId);
                }
            });
        });
    }

    startWebSocket() {
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
                } }`,
            }));
        });

        this._ws.on("message", (data_) => {
            const data = JSON.parse(data_).vehicle;
            if (!data) return;

            const { position, timestamp, trip, vehicle } = data;
            if (!position || !timestamp || !trip || !vehicle) return;

            const { id } = vehicle;
            if (!id) return;

            const { routeId, directionId } = trip;
            if (!routeId || directionId === undefined) return;

            const [lat, lng] = [position.latitude, position.longitude];
            if (!lat || !lng) return;

            const route = this._byRouteId.get(routeId);
            const processedVehicle = {
                vehicleId:       id,
                lastUpdatedUnix: Number.parseInt(timestamp, 10),
                directionId,
                position:        {
                    lat,
                    lng,
                },
            };
            route.vehicles.set(id, processedVehicle);
            this._uWSApp.publish(route.shortName, JSON.stringify(processedVehicle));
        });

        this._ws.on("error", err => {
            // buggy AT server returns "Unexpected server response: 503"
            if (err.message !== "Unexpected server response: 503") {
                throw err;
            }
        });

        this._ws.on("close", code => {
            // reconnect if buggy AT server returns "Unexpected server response: 503"
            if (code === 1006) {
                setTimeout(() => this.startWebSocket(), SLEEP_BEFORE_WS_RECONNECT);
            }
            this._ws = null;
        });
    }

    stopWebSocket() {
        this._ws.close(1000);
    }

    async load() {
        // routes are required to look up short names
        const routes = await this.query("gtfs/routes");
        const filteredRoutes = routes.filter(r => r.route_id.endsWith(this._version));
        for (const route of filteredRoutes) {
            const shortName = route.route_short_name;
            if (!this._byShortName.has(shortName)) {
                this._byShortName.set(shortName, {
                    shortName,
                    routeIds:  new Set(),
                    shapeIds:  [new Set(), new Set()],
                    polylines: [[], []],
                    vehicles:  new Map(),
                });
            }
            this._byShortName.get(shortName).routeIds.add(route.route_id);
            this._byRouteId.set(route.route_id, this._byShortName.get(shortName));
        }

        // trips are required for fetching shapes
        const trips = await this.query("gtfs/trips");
        const filteredTrips = trips.filter(t => t.trip_id.endsWith(this._version));
        for (const trip of filteredTrips) {
            this._byRouteId.get(trip.route_id).shapeIds[trip.direction_id].add(trip.shape_id);
        }

        // shapeIds => polylines
        await Promise.allSettled(Array.from(this._byShortName, async ([_, processedRoute]) => {
            for (let i = 0; i < 2; i++) {
                /* eslint-disable no-param-reassign, no-await-in-loop */
                if (processedRoute.shapeIds[i].size === 0) {
                    processedRoute.polylines[0] = [];
                    continue;
                }
                // seems like the lowest number has the full route, while higher
                //   numbers of the same version have additional peak-time routes?
                const shapeId = [...processedRoute.shapeIds[i]].sort()[0];
                const shape = await this.query(`gtfs/shapes/shapeId/${shapeId}`);
                processedRoute.polylines[i] = shape.map(s => ({ lat: s.shape_pt_lat, lng: s.shape_pt_lon }));
            }
        }));

        // load vehicle positions
        const response = await this.query("public/realtime/vehiclelocations", "noCache");
        const now = (new Date()).getTime();
        for (const vehicle_ of response.entity) {
            const { vehicle, id } = vehicle_;
            if (!vehicle || !id) continue;

            const { trip, position, timestamp } = vehicle;
            if (!trip || !position || !timestamp) continue;

            const [routeId, directionId] = [trip.route_id, trip.direction_id];
            if (!routeId || !directionId) continue;

            const [lat, lng] = [position.latitude, position.longitude];
            if (!lat || !lng) continue;

            // ignore vehicles more than 2 minutes old
            if (timestamp * 1000 < now - OLD_VEHICLE_THRESHOLD) continue;

            this._byRouteId.get(routeId).vehicles.set(id, {
                vehicleId:       id,
                lastUpdatedUnix: Number.parseInt(timestamp, 10),
                directionId,
                position:        {
                    lat,
                    lng,
                },
            });
        }
    }

    async lookForUpdates(forceLoad) {
        const cachedVersion = this._cache.load("latest-version");
        await this.queryLatestVersion();
        if (cachedVersion !== this._version) {
            this._cache.clear();
            this._cache.store("latest-version", this._version);
            await this.load();
        }
        else if (forceLoad) {
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

module.exports = AucklandTransportData;
