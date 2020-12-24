import WebSocket from "ws";
import logger from "~/logger";
import { CLOSE_CODE_RESTART, PersistentWebSocket, PersistentWebSocketOpts } from "~/PersistentWebSocket";
import { convertATVehicleRawWSToATVehicle } from "./normalizers";
import { isATVehicleRawWS } from "./typeChecks";

const WS_CODE_CLOSE_PLANNED_SHUTDOWN = 4000;
const SLEEP_BEFORE_WS_RECONNECT_503 = 500;
const SLEEP_BEFORE_WS_RECONNECT_502 = 60 * 1000;
const SLEEP_BEFORE_WS_RECONNECT_GENERIC = 500;

export interface ATWebSocketOpts {
    onDisconnect?: ((ws: WebSocket) => void);
    onReconnect?: ((ws: WebSocket) => void);
    onVehicleUpdate: (vehicle: ATVehicle) => void;
    url: string;
}

export class ATWebSocket {
    private onVehicleUpdate: (vehicle: ATVehicle) => void;
    private url: string;
    private ws: PersistentWebSocket;
    private wsOpts: PersistentWebSocketOpts;

    constructor(opts: ATWebSocketOpts) {
        this.wsOpts = {
            onDisconnect: opts.onDisconnect,
            onReconnect: opts.onReconnect,
            url: opts.url,
        };
        this.onVehicleUpdate = opts.onVehicleUpdate;

        this.startWebSocket();
    }

    private startWebSocket() {
        this.ws = new PersistentWebSocket({
            ...this.wsOpts,
            onOpen: ws => {
                logger.info("ATWebSocket open");
                ws.send(JSON.stringify({
                    // appears to be a stripped-down GraphQL API
                    filters: { "vehicle.trip.scheduleRelationship": ["SCHEDULED"] },
                    query: `{ vehicle {
                        vehicle { id }
                        trip { routeId directionId }
                        position { latitude longitude }
                        timestamp
                        occupancyStatus
                    } }`,
                }));
            },
            onMessage: (ws, data_) => {
                const data = JSON.parse(data_).vehicle;
                if (isATVehicleRawWS(data)) {
                    this.onVehicleUpdate(convertATVehicleRawWSToATVehicle(data));
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
            onClose: (ws, code) => {
                logger.info("ATWebSocket close", code);
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