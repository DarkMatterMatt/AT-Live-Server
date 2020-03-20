const uWS = require("uWebSockets.js");
const AucklandTransportData = require("./AucklandTransportData");
const C = require("./config");

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

/* Subscribe / publish by route short names */
const aucklandTransportData = new AucklandTransportData(C.aucklandTransport, app);

(async () => {
    await aucklandTransportData.lookForUpdates("forceLoad");
    aucklandTransportData.startAutoUpdates();

    process.on("SIGINT", () => {
        console.log("Caught interrupt signal");
        aucklandTransportData.stopAutoUpdates();
        process.exit();
    });

    app.ws("/v1/websocket", {
        ...C.ws.v1.opts,

        message: (ws, message) => {
            if (!message.byteLength) {
                ws.send(JSON.stringify({
                    status: "error",
                    error:  "No data recieved. Expected data in a JSON format.",
                }));
                return;
            }
            let json;
            try {
                json = JSON.parse(Buffer.from(message));
            }
            catch (e) {
                ws.send(JSON.stringify({
                    status: "error",
                    error:  "Invalid JSON data recieved.",
                }));
                return;
            }

            const validRoutes = ["subscribe", "unsubscribe", "ping"];
            if (!json.route) {
                ws.send(JSON.stringify({
                    status: "error",
                    error:  "Missing 'route' field.",
                }));
                return;
            }
            if (!validRoutes.includes(json.route)) {
                ws.send(JSON.stringify({
                    status: "error",
                    error:  `'route' field must be one of [${validRoutes.join(",")}].`,
                }));
                return;
            }

            switch (json.route) {
                case "subscribe": {
                    const { shortName } = json;
                    if (!shortName) {
                        ws.send(JSON.stringify({
                            route:  "subscribe",
                            status: "error",
                            error:  "Missing 'shortName' field.",
                        }));
                        return;
                    }
                    if (!aucklandTransportData.hasRouteByShortName(shortName)) {
                        ws.send(JSON.stringify({
                            route:  "subscribe",
                            status: "error",
                            error:  `Unknown route with shortName '${shortName}'.`,
                            shortName,
                        }));
                        return;
                    }
                    ws.subscribe(`${shortName}`);
                    ws.send(JSON.stringify({
                        route:   "subscribe",
                        status:  "success",
                        message: `Subscribed to '${shortName}'.`,
                        shortName,
                    }));
                    return;
                }
                case "unsubscribe": {
                    const { shortName } = json;
                    if (!shortName) {
                        ws.send(JSON.stringify({
                            route:  "unsubscribe",
                            status: "error",
                            error:  "Missing 'shortName' field.",
                        }));
                        return;
                    }
                    if (!aucklandTransportData.hasRouteByShortName(shortName)) {
                        ws.send(JSON.stringify({
                            route:  "unsubscribe",
                            status: "error",
                            error:  `Unknown route with shortName '${shortName}'.`,
                            shortName,
                        }));
                        return;
                    }
                    ws.unsubscribe(`${shortName}`);
                    ws.send(JSON.stringify({
                        route:     "unsubscribe",
                        status:    "success",
                        message:   `Unsubscribed from '${shortName}'.`,
                        shortName,
                    }));
                    return;
                }
                default: // this should never happen
                case "ping": {
                    ws.send(JSON.stringify({
                        route:   "ping",
                        status:  "success",
                        message: "pong",
                    }));
                }
            }
        },
    });

    app.get("/v1/shortname/:shortName", (res, req) => {
        const shortName = req.getParameter(0).toUpperCase();
        res.writeHeader("Content-Type", "application/json");

        const route = aucklandTransportData.getRouteByShortName(shortName);

        if (!route) {
            res.end(JSON.stringify({
                status: "error",
                error:  "Specified route does not exist.",
            }));
            return;
        }

        const { polylines } = route;
        const vehicles = [...route.vehicles.values()];

        res.end(JSON.stringify({
            status: "success",
            shortName,
            polylines,
            vehicles,
        }));
    });

    app.any("/*", res => {
        res.end("Invalid endpoint");
    });

    app.listen(9001, listenSocket => {
        if (listenSocket) {
            console.log("Listening to port 9001");
        }
    });
})();
