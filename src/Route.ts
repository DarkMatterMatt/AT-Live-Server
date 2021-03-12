import { WebSocket } from "uWebSockets.js";
import AucklandTransportData from "./AucklandTransportData";

export interface RouteExecuteOpts {
    aucklandTransportData: AucklandTransportData;
    activeWebSockets: Set<WebSocket>;
}

export default abstract class Route {
    protected _name: string;

    constructor(name: string) {
        this._name = name;
    }
}
