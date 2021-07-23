import uWS, { DISABLED, SHARED_COMPRESSOR, us_listen_socket, WebSocket } from "uWebSockets.js";
import AucklandTransportData from "./AucklandTransportData";
import C from "./config";
import webSocketRoutes from "./webSocketRoutes";
import getRoutes from "./getRoutes";
import logger from "./logger";
import { URLSearchParams } from "url";
import { TextDecoder } from "util";
import { WSOutput } from "~/output";

const WS_CODE_CLOSE_GOING_AWAY = 1001;

process.on("unhandledRejection", err => {
    logger.error("unhandledRejection:", err);
});

process.on("uncaughtException", err => {
    logger.error("uncaughtException:", err);
});

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

const output = new WSOutput(app);

/* Subscribe / publish by route short names */
const aucklandTransportData = new AucklandTransportData(C.aucklandTransport, output);

(async () => {
    const activeWebSockets = new Set<WebSocket>();
    let listenSocket: us_listen_socket;

    await aucklandTransportData.lookForUpdates("forceLoad");
    aucklandTransportData.startAutoUpdates();

    process.on("SIGINT", () => {
        logger.info("Caught interrupt signal");
        logger.debug("Current status", {
            websocketUpdates: aucklandTransportData.webSocketActive(),
            livePollingUpdates: aucklandTransportData.livePollingActive(),
            lastVehicleUpdate : aucklandTransportData.getLastVehicleUpdate(),
            activeWebSockets: activeWebSockets.size,
            version: process.env.npm_package_version,
        });

        aucklandTransportData.stopAutoUpdates();
        for (const ws of activeWebSockets.values()) {
            ws.end(WS_CODE_CLOSE_GOING_AWAY, "Server is shutting down");
        }
        uWS.us_listen_socket_close(listenSocket);
        process.exit();
    });

    app.ws("/v1/websocket", {
        ...C.ws.v1.opts,

        compression: C.ws.v1.opts.compression ? SHARED_COMPRESSOR : DISABLED,

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
                    message: "No data recieved. Expected data in a JSON format.",
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
            catch (e) {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Invalid JSON data recieved.",
                }));
                return;
            }

            const routeName = json.route;
            if (typeof routeName !== "string" || routeName === "") {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Missing 'route' field.",
                }));
                return;
            }

            const route = webSocketRoutes.get(routeName) || webSocketRoutes.get("default");
            route.execute({ ws, json, aucklandTransportData, activeWebSockets });
        },
    });

    app.get("/v1/:route", (res, req) => {
        const routeName = req.getParameter(0);
        const params = new URLSearchParams(req.getQuery());
        const route = getRoutes.get(routeName) || getRoutes.get("default");
        route.execute({ res, req, params, aucklandTransportData, activeWebSockets });
    });

    app.get("/generate_204", res => {
        res.writeStatus("204 No Content").end();
    });

    app.any("/*", res => {
        res.writeStatus("404 Not Found");
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
            status:  "error",
            message: "404 Not Found",
        }));
    });

    const port = C.port || 9001;
    app.listen(port, token => {
        if (token) {
            listenSocket = token;
            logger.info(`Listening to port ${port}`);
        }
    });
})();
