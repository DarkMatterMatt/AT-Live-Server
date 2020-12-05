const CRC32 = require("crc-32");
const Route = require("./Route");

const DEFAULT_CACHE_MAX_AGE = 3600; // 1 hour

class GetRoute extends Route {
    constructor(...args) {
        super(...args);
        this._cacheMaxAge = null;

        // reset every request
        this._req = null;
        this._res = null;
        this._cacheMaxAgeThisReq = null;
    }

    setCacheMaxAge(secs) {
        if (this._req === null) {
            // not inside a request, disable for all requests to this route
            this._cacheMaxAge = secs;
        }
        else {
            // only set the max cache for this request
            this._cacheMaxAgeThisReq = secs;
        }
        return this;
    }

    execute(data, ...args) {
        this._res = data.res;
        this._req = data.req;
        this._executor(data, ...args);
    }

    finish(status, data) {
        const json = JSON.stringify({
            ...data,
            status,
            route: this._name,
        });

        let cacheMaxAge = DEFAULT_CACHE_MAX_AGE;
        if (this._cacheMaxAgeThisReq !== null) {
            cacheMaxAge = this._cacheMaxAgeThisReq;
        }
        else if (this._cacheMaxAge !== null) {
            cacheMaxAge = this._cacheMaxAge;
        }

        if (cacheMaxAge <= 0) {
            this._res.writeHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            this._res.writeHeader("Pragma", "no-cache");
            this._res.writeHeader("Expires", "0");
        }
        else {
            const crc32 = CRC32.str(json) >>> 0;
            const tag = `W/"${crc32}"`;
            const clientTag = this._req.getHeader("if-none-match");

            if (tag === clientTag) {
                this._res.writeStatus("304 Not Modified");
                this._res.end();
                return;
            }
            this._res.writeHeader("ETag", tag);

            const d = new Date();
            d.setSeconds(d.getSeconds() + cacheMaxAge);
            this._res.writeHeader("Cache-Control", `max-age=${cacheMaxAge}`);
            this._res.writeHeader("Expires", d.toUTCString());
        }

        this._res.writeHeader("Content-Type", "application/json");
        this._res.writeHeader("Access-Control-Allow-Origin", "*");
        this._res.end(json);

        this._res = null;
        this._req = null;
        this._cacheMaxAgeThisReq = null;
    }
}

module.exports = GetRoute;
