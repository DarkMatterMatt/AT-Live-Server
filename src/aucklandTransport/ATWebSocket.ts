import WebSocket from "ws";
import logger from "~/logger";
import { CLOSE_CODE_RESTART, PersistentWebSocket } from "~/PersistentWebSocket";
import { convertATVehicleRawWSToATVehicleUnprocessed } from "./normalizers";
import { isATVehicleRawWS } from "./typeChecks";

export const WS_CODE_CLOSE_PLANNED_SHUTDOWN = 4000;
const SLEEP_BEFORE_WS_RECONNECT_503 = 500;
const SLEEP_BEFORE_WS_RECONNECT_502 = 60 * 1000;
const SLEEP_BEFORE_WS_RECONNECT_GENERIC = 500;

export interface ATWebSocketOpts {
    onConnect?: ((ws: WebSocket) => void);
    onDisconnect?: ((ws: WebSocket, code: number, reason: string) => void);
    onVehicleUpdate: (vehicle: ATVehicleUnprocessed) => void;
    url: string;
}

export class ATWebSocket {
    private onConnect: ((ws: WebSocket) => void) | null = null;
    private onDisconnect: ((ws: WebSocket, code: number, reason: string) => void) | null = null;
    private onVehicleUpdate: (vehicle: ATVehicleUnprocessed) => void;
    private url: string;
    private ws: PersistentWebSocket;

    constructor(opts: ATWebSocketOpts) {
        this.url = opts.url;

        this.onVehicleUpdate = opts.onVehicleUpdate;

        if (opts.onConnect != null) {
            this.onConnect = opts.onConnect;
        }

        if (opts.onDisconnect != null) {
            this.onDisconnect = opts.onDisconnect;
        }

        this.startWebSocket();
    }

    private startWebSocket() {
        this.ws = new PersistentWebSocket({
            url: this.url,
            onOpen: ws => {
                logger.info("ATWebSocket open");
                ws.send(JSON.stringify({
                    // appears to be a stripped-down GraphQL API
                    filters: { "vehicle.trip.scheduleRelationship": ["SCHEDULED"] },
                    query: "{ vehicle }",
                }));

                if (this.onConnect != null) {
                    this.onConnect(ws);
                }
            },
            onMessage: (ws, data_) => {
                const data = JSON.parse(data_).vehicle;
                if (isATVehicleRawWS(data)) {
                    this.onVehicleUpdate(convertATVehicleRawWSToATVehicleUnprocessed(data));
                }
            },
            onError: (ws, err) => {
                logger.info("ATWebSocket error", err);

                // HTTP errors (only while connecting?)
                // buggy AT server returns 503 (AKA retry cause it's only
                // temporarily broken), and has been known to break badly and
                // 502 (this is kinda perma-broken, wait a bit before reconnecting)
                if (err.message === "Unexpected server response: 503") {
                    logger.warn(`WebSocket returned error 503, retrying in ${SLEEP_BEFORE_WS_RECONNECT_503}ms`);
                    return SLEEP_BEFORE_WS_RECONNECT_503;
                }
                if (err.message === "Unexpected server response: 502") {
                    logger.warn(`WebSocket returned error 502, retrying in ${SLEEP_BEFORE_WS_RECONNECT_502}ms`);
                    return SLEEP_BEFORE_WS_RECONNECT_502;
                }
                throw err;
            },
            onClose: (ws, code, reason) => {
                logger.info("ATWebSocket close", code);

                if (this.onDisconnect != null) {
                    this.onDisconnect(ws, code, reason);
                }

                if (code === WS_CODE_CLOSE_PLANNED_SHUTDOWN) {
                    // planned closure, requested internally
                    logger.verbose("WebSocket closed as part of a planned shutdown.");
                    return false;
                }

                if (code === CLOSE_CODE_RESTART) {
                    // planned closure
                    logger.verbose("WebSocket close with code: CLOSE_CODE_RESTART");
                    return false;
                }

                if (code === 1006) {
                    // abnormal closure, restart the websocket
                    // (error handler may have already set restartWebSocketTimeout)
                    if (!this.ws.restartPending()) {
                        logger.warn(
                            `WebSocket closed unexpectedly, restarting in ${SLEEP_BEFORE_WS_RECONNECT_GENERIC}ms`);
                        return SLEEP_BEFORE_WS_RECONNECT_GENERIC;
                    }
                    return;
                }

                throw new Error(`Unknown close code: ${code}`);
            },
        });
    }

    public destroy(closeCode: number, closeData?: string): void {
        this.ws.destroy(closeCode, closeData);
    }

    public isActive(): boolean {
        return this.ws.isActive();
    }
}