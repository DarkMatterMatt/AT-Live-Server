const uWS = require("uWebSockets.js");
const AucklandTransportData = require("./AucklandTransportData");
const C = require("./config");

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

/* Subscribe / publish by route short names */
const aucklandTransportData = new AucklandTransportData(C.aucklandTransport, app);

(async () => {
    await aucklandTransportData.lookForUpdates("forceLoad");
    aucklandTransportData.startAutoUpdates();
    aucklandTransportData.startWebSocket();

    process.on("SIGINT", () => {
        console.log("Caught interrupt signal");
        aucklandTransportData.stopAutoUpdates();
        aucklandTransportData.stopWebSocket();
        process.exit();
    });

    app.ws("/v1/websocket", {
        ...C.ws.v1.opts,

        message: (ws, message) => {
            let json;
            try {
                json = JSON.parse(Buffer.from(message));
            }
            catch (e) {
                ws.send(JSON.stringify({
                    status: "error",
                    error:  "Invalid JSON data recieved",
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
                    error:  `'route' field must be one of [${validRoutes.join(",")}]`,
                }));
                return;
            }

            switch (json.route) {
                case "subscribe": {
                    if (!json.shortName) {
                        ws.send(JSON.stringify({
                            status: "error",
                            error:  "Missing 'shortName' field.",
                        }));
                        return;
                    }
                    if (!aucklandTransportData.hasRouteByShortName(json.shortName)) {
                        ws.send(JSON.stringify({
                            status: "error",
                            error:  `Unknown route with shortName '${json.shortName}'.`,
                        }));
                        return;
                    }
                    ws.subscribe(`${json.shortName}`);
                    ws.send(JSON.stringify({
                        status:  "success",
                        message: `Subscribed to '${json.shortName}'`,
                    }));
                    return;
                }
                case "unsubscribe": {
                    if (!json.shortName) {
                        ws.send(JSON.stringify({
                            status: "error",
                            error:  "Missing 'shortName' field.",
                        }));
                        return;
                    }
                    if (!aucklandTransportData.hasRouteByShortName(json.shortName)) {
                        ws.send(JSON.stringify({
                            status: "error",
                            error:  `Unknown route with shortName '${json.shortName}'.`,
                        }));
                        return;
                    }
                    ws.unsubscribe(`${json.shortName}`);
                    ws.send(JSON.stringify({
                        status:  "success",
                        message: `Unsubscribed from '${json.shortName}'`,
                    }));
                    return;
                }
                default: // this should never happen
                case "ping": {
                    ws.send(JSON.stringify({
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
