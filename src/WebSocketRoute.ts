import { WebSocket } from "uWebSockets.js";
import Route, { RouteExecuteOpts } from "./Route";

interface WebSocketRouteExecuteOpts extends RouteExecuteOpts {
    ws: WebSocket;
    json: Record<string, any>;
}

export default class WebSocketRoute extends Route {
    private _executor: null | ((route: this, data: WebSocketRouteExecuteOpts) => void) = null;
    private _ws: WebSocket = null;

    public setExecutor(fn: (route: this, data: WebSocketRouteExecuteOpts) => void): this {
        this._executor = fn;
        return this;
    }

    public execute(data: WebSocketRouteExecuteOpts): void {
        if (this._executor == null) {
            return;
        }

        this._ws = data.ws;
        this._executor(this, data);
    }

    public finish(status: string, data: Record<string, any>): void {
        const json = JSON.stringify({
            ...data,
            status,
            route: this._name,
        });
        this._ws.send(json);

        this._ws = null;
    }
}
