import CRC32 from "crc-32";
import { URLSearchParams } from "url";
import { HttpRequest, HttpResponse } from "uWebSockets.js";
import Route, { RouteExecuteOpts } from "./Route";

const DEFAULT_CACHE_MAX_AGE = 3600; // 1 hour

interface GetRouteExecuteOpts extends RouteExecuteOpts {
    params: URLSearchParams;
    res: HttpResponse;
    req: HttpRequest;
}

export default class GetRoute extends Route {
    private _cacheMaxAge = -1;
    private _cacheMaxAgeThisReq = -1;
    private _executor: null | ((route: this, data: GetRouteExecuteOpts) => void) = null;
    private _req: HttpRequest = null;
    private _res: HttpResponse = null;

    public setCacheMaxAge(secs: number): GetRoute {
        if (this._req == null) {
            // not inside a request, disable for all requests to this route
            this._cacheMaxAge = secs;
        }
        else {
            // only set the max cache for this request
            this._cacheMaxAgeThisReq = secs;
        }
        return this;
    }

    public setExecutor(fn: (route: this, data: GetRouteExecuteOpts) => void): this {
        this._executor = fn;
        return this;
    }

    public execute(data: GetRouteExecuteOpts): void {
        if (this._executor == null) {
            return;
        }

        this._res = data.res;
        this._req = data.req;
        this._executor(this, data);
    }

    public finish(status: "success" | "error", data: Record<string, any>): void {
        const json = JSON.stringify({
            ...data,
            status,
            route: this._name,
        });

        let cacheMaxAge = DEFAULT_CACHE_MAX_AGE;
        if (this._cacheMaxAgeThisReq <= 0) {
            cacheMaxAge = this._cacheMaxAgeThisReq;
        }
        else if (this._cacheMaxAge <= 0) {
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
