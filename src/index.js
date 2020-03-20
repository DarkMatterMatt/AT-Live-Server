const uWS = require("uWebSockets.js");
const AucklandTransportData = require("./AucklandTransportData");
const C = require("./config");
const routes = require("./routes");

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
                    status:  "error",
                    message: "No data recieved. Expected data in a JSON format.",
                }));
                return;
            }
            let json;
            try {
                json = JSON.parse(Buffer.from(message));
            }
            catch (e) {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Invalid JSON data recieved.",
                }));
                return;
            }

            const routeName = json.route;
            if (!routeName) {
                ws.send(JSON.stringify({
                    status:  "error",
                    message: "Missing 'route' field.",
                }));
                return;
            }

            const route = routes.get(routeName) || routes.get("default");
            const invalidParams = route.invalidParams(json);
            if (invalidParams) {
                ws.send(route.jsonStringify("error", {
                    message: invalidParams,
                }));
                return;
            }
            route.execute(ws, json, aucklandTransportData);
        },
    });

    app.get("/v1/shortname/:shortName", (res, req) => {
        const shortName = req.getParameter(0).toUpperCase();
        res.writeHeader("Content-Type", "application/json");

        const route = aucklandTransportData.getRouteByShortName(shortName);

        if (!route) {
            res.end(JSON.stringify({
                route:  "shortname",
                status: "error",
                error:  "Specified route does not exist.",
            }));
            return;
        }

        const { polylines, longName } = route;
        const vehicles = [...route.vehicles.values()];

        res.end(JSON.stringify({
            route:  "shortname",
            status: "success",
            shortName,
            longName,
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
