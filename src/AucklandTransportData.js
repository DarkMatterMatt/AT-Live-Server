const fetch = require("node-fetch");
const pLimit = require("p-limit");
const Cache = require("./Cache");
const C = require("./config");

class AucklandTransportData {
    constructor(key, baseUrl) {
        this._key = key;
        this._baseUrl = baseUrl;
        this._version = "";
        this._routes = [];
        this._trips = [];
        this._shapes = [];
        this._cache = new Cache("ATCache", C.aucklandTransport.maxCacheSizeInBytes);
        this._pLimit = pLimit(C.aucklandTransport.maxParallelRequests);
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

    async getLatestVersion() {
        const versions = await this.query("gtfs/versions", "noCache");

        // note: AT does this weird thing where a version will end at midnight on a day, but the next one
        //   technically doesn't kick in till the next day. (e.g. ends at 0am on Monday, starts at 0am Tuesday)
        // note2: AT displays times as UTC but they are actually local time
        const now = this.constructor._localIsoDate();
        const filtered = versions.filter(v => v.startdate.split("T")[0] <= now && now <= v.enddate.split("T")[0]);
        if (filtered.length === 0) {
            console.error("No versions are currently active", versions);
            return "";
        }
        return filtered[0].version;
    }

    async update() {
        const cachedVersion = this._cache.load("latest-version");
        const latestVersion = this.getLatestVersion();
        if (cachedVersion !== latestVersion) {
            this._cache.clear();
            this._cache.store("latest-version", latestVersion);
            await this.loadAllRoutes();
            await this.loadAllTrips();
            await this.loadAllShapes();
        }
    }

    beginAutoUpdates() {
        this._autoUpdate = setInterval(() => this.update(), 5 * 60 * 1000);
    }

    stopAutoUpdates() {
        clearInterval(this._autoUpdate);
    }

    async validateApiKey() {
        if (!this._apiKey || this._apiKey.length !== 32) {
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

    async loadAllRoutes() {
        // routes are required to look up short names
        this._trips = await this.query("gtfs/routes");
    }

    async loadAllTrips() {
        // trips are required for fetching shapes
        this._trips = await this.query("gtfs/trips");
    }

    async loadAllShapes() {
        await this.loadAllShapes();
        const shapeIds = [...new Set(this._trips.map(t => t.shape_id))];
        this._shapes = await Promise.all(shapeIds.map(id => this.query(`gtfs/shapes/shapeId/${id}`)));
    }
}

module.exports = ATCache;
