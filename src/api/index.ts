import { URLSearchParams } from "node:url";
import Graceful from "node-graceful";
import uWS, { us_listen_socket, WebSocket } from "uWebSockets.js";
import log from "~/log.js";
import env from "~/env.js";
import apiRoutes, { defaultRoute as defaultApiRoute } from "./api/";
import wsRoutes, { defaultRoute as defaultWsRoute } from "./ws/";
import type { DataSource, RegionCode } from "~/types";

const WS_CODE_CLOSE_GOING_AWAY = 1001;

export interface StartOpts {
    availableRegions: RegionCode[];
    getRegion: (region: string) => DataSource | null;
}

export async function start({ availableRegions, getRegion }: StartOpts): Promise<void> {
    const activeWebSockets = new Set<WebSocket>();
    let listenSocket: us_listen_socket;

    Graceful.on("exit", () => {
        log.debug("Current webserver status", {
            version: process.env.npm_package_version,
        });

        for (const ws of activeWebSockets.values()) {
            ws.end(WS_CODE_CLOSE_GOING_AWAY, "Server is shutting down");
        }
        uWS.us_listen_socket_close(listenSocket);
    });

    const app = env.USE_SSL ? uWS.SSLApp({
        key_file_name: env.SSL_KEY_FILE,
        cert_file_name: env.SSL_CERT_FILE,
    }) : uWS.App();

    app.ws("/v3/websocket", {
        open: ws => {
            activeWebSockets.add(ws);
        },

        close: ws => {
            activeWebSockets.delete(ws);
        },

        message: (ws, message) => {
            if (!message.byteLength) {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "No data received. Expected data in a JSON format.",
                }));
                return;
            }
            let json;
            try {
                json = JSON.parse(new TextDecoder("utf8").decode(message));
                if (typeof json !== "object" || json == null) {
                    throw new Error("Expected an object.");
                }
            }
            catch {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Invalid JSON data received.",
                }));
                return;
            }

            const { route: routeName, seq } = json;
            delete json.route;
            delete json.seq;

            if (typeof routeName !== "string" || routeName === "") {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Missing required field: route.",
                }));
                return;
            }

            if (typeof seq !== "number") {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Missing required field: seq.",
                }));
                return;
            }

            const route = wsRoutes.get(routeName) || defaultWsRoute;
            route.createRoute({ ws, seq })
                .execute({
                    params: json,
                    activeWebSockets,
                    availableRegions,
                    getRegion,
                });
        },
    });

    app.get("/v3/:route", (res, req) => {
        const routeName = req.getParameter(0);
        const params = new URLSearchParams(req.getQuery());
        const headers: Record<string, string> = {};
        req.forEach((k, v) => headers[k] = v);

        const route = apiRoutes.get(routeName) || defaultApiRoute;
        route.createRoute({ res, headers })
            .execute({
                params,
                activeWebSockets,
                availableRegions,
                getRegion,
            });
    });

    app.any("/generate_204", res => {
        res.writeStatus("204 No Content").end();
    });

    app.any("/*", res => {
        res.writeStatus("404 Not Found");
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
            status:  "error",
            message: "404 Not Found.",
        }));
    });

    app.listen(env.PORT, token => {
        if (token) {
            listenSocket = token;
            log.info(`Listening to port ${env.PORT}`);
        }
    });
}