import WebSocket from "ws";

export const EXPECT_PING_RESPONSE_IN_MS = 2000;
export const CLOSE_CODE_RESTART = 4002;
export const RESTART_DELAY_AFTER_DISCONNECT = 100;

export interface PersistentWebSocketOpts {
    healthCheckFrequency?: number;
    /**
     * Callback function, return false to disable automatic restart,
     * return number to restart in specified number of milliseconds.
     */
    onClose?: (ws: WebSocket, code: number, reason: string) => undefined | false | number;
    onDisconnect?: ((ws: WebSocket) => void);
    /**
     * Callback function, return false to disable automatic restart,
     * return number to restart in specified number of milliseconds.
     */
    onError?: (ws: WebSocket, err: Error) => undefined | false | number;
    onMessage?: (ws: WebSocket, data: string) => void;
    onOpen?: (ws: WebSocket) => void;
    onReconnect?: ((ws: WebSocket) => void);
    url: string;
}

export class PersistentWebSocket {
    private healthCheckFrequency = 2000;
    private healthCheckInProgress = false;
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private lastMessageOrPong = 0;
    private onClose: ((ws: WebSocket, code: number, reason: string) => undefined | false | number) | null = null;
    private onDisconnect: ((ws: WebSocket) => void) | null = null;
    private onError: ((ws: WebSocket, err: Error) => undefined | false | number) | null = null;
    private onMessage: ((ws: WebSocket, data: string) => void) | null = null;
    private onOpen: ((ws: WebSocket) => void) | null = null;
    private onReconnect: ((ws: WebSocket) => void) | null = null;
    private restartTimeout: ReturnType<typeof setTimeout> | null = null;
    private url: string;
    private userRequestedClose = false;
    private ws: WebSocket;

    constructor(opts: PersistentWebSocketOpts) {
        if (opts.onClose != null) {
            this.onClose = opts.onClose;
        }
        if (opts.onDisconnect != null) {
            this.onDisconnect = opts.onDisconnect;
        }
        if (opts.onError != null) {
            this.onError = opts.onError;
        }
        if (opts.onMessage != null) {
            this.onMessage = opts.onMessage;
        }
        if (opts.onOpen != null) {
            this.onOpen = opts.onOpen;
        }
        if (opts.onReconnect != null) {
            this.onReconnect = opts.onReconnect;
        }
        if (opts.healthCheckFrequency != null) {
            this.healthCheckFrequency = opts.healthCheckFrequency;
        }
        this.url = opts.url;

        this.start();
        this.startHealthChecks();
    }

    private restart(ms: number) {
        if (ms < 0) {
            throw new Error(`Invalid restart timeout: ${ms}ms`);
        }

        if (this.restartTimeout != null) {
            // already restarting
            return;
        }

        if (this.ws.readyState === this.ws.OPEN) {
            this.ws.close(CLOSE_CODE_RESTART, "Restarting websocket");
        }

        this.restartTimeout = setTimeout(() => this.start(), ms);
    }

    private start(): void {
        // shouldn't need to clear it, as this function should be the timeout's callback
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.on("close", (code, reason) => {
            // auto restart websocket in 500ms by default
            let autoRestart = this.userRequestedClose ? -1 : 500;

            if (this.onClose != null) {
                const userRestart = this.onClose(ws, code, reason);
                if (userRestart != null) {
                    autoRestart = (userRestart === false || userRestart < 0) ? -1 : userRestart;
                }
            }

            if (autoRestart >= 0) {
                this.restart(autoRestart);
            }
        });

        ws.on("error", err => {
            // auto restart websocket in 500ms by default
            let autoRestart = 500;

            if (this.onError != null) {
                const userRestart = this.onError(ws, err);
                if (userRestart != null) {
                    autoRestart = (userRestart === false || userRestart < 0) ? -1 : userRestart;
                }
            }

            if (autoRestart >= 0) {
                this.restart(autoRestart);
            }
        });

        ws.on("message", data => {
            this.lastMessageOrPong = Date.now();

            if (typeof data !== "string") {
                throw new Error ("Handling of non-string data is not implemented");
            }

            if (this.onMessage != null) {
                this.onMessage(ws, data);
            }
        });

        ws.on("open", () => {
            if (this.lastMessageOrPong !== 0) {
                if (this.onReconnect != null) {
                    this.onReconnect(ws);
                }
            }

            this.lastMessageOrPong = Date.now();

            if (this.onOpen != null) {
                this.onOpen(ws);
            }
        });

        ws.on("pong", _ => {
            this.lastMessageOrPong = Date.now();
        });

    }

    private startHealthChecks(): void {
        // every 500ms we'll check if we recieved data recently
        this.healthCheckInterval = setInterval(() => this.healthCheck(), 500);
    }

    private healthCheck(): void {
        if (this.ws.readyState !== this.ws.OPEN || this.restartPending()) {
            // only check health when it is supposed to be connected
            return;
        }
        if (this.lastMessageOrPong > Date.now() - this.healthCheckFrequency) {
            // we recieved data recently
            return;
        }
        if (this.healthCheckInProgress) {
            // currently waiting for a reply to our ping
            return;
        }
        this.healthCheckInProgress = true;

        // we haven't recieved data recently, send ping
        const pingSent = Date.now();
        this.ws.ping();
        setTimeout(() => {
            // no reply to ping (last data was recieved before we sent the ping)
            if (this.lastMessageOrPong < pingSent) {
                if (this.onDisconnect != null) {
                    this.restart(RESTART_DELAY_AFTER_DISCONNECT);
                    this.onDisconnect(this.ws);
                }
            }
            this.healthCheckInProgress = false;
        }, EXPECT_PING_RESPONSE_IN_MS);
    }

    public isActive(): boolean {
        return this.ws.readyState === this.ws.OPEN;
    }

    public restartPending(): boolean {
        return this.restartTimeout != null;
    }

    public destroy(closeCode: number, closeData?: string): void {
        if (this.ws == null) {
            // already destroyed
            return;
        }
        this.userRequestedClose = true;
        clearInterval(this.healthCheckInterval);
        clearTimeout(this.restartTimeout);
        this.ws && this.ws.close(closeCode, closeData);
        this.ws = null;
    }
}
