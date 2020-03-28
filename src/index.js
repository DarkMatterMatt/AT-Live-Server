const uWS = require("uWebSockets.js");
const AucklandTransportData = require("./AucklandTransportData");
const C = require("./config");
const webSocketRoutes = require("./webSocketRoutes");
const getRoutes = require("./getRoutes");

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

/* Subscribe / publish by route short names */
const aucklandTransportData = new AucklandTransportData(C.aucklandTransport, app);

(async () => {
    await aucklandTransportData.lookForUpdates("forceLoad");
    aucklandTransportData.startAutoUpdates();

    process.on("SIGINT", () => {
        console.log("Caught interrupt signal");
        aucklandTransportData.stopAutoUpdates();
        aucklandTransportData.stopWebSocket();
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

            const route = webSocketRoutes.get(routeName) || webSocketRoutes.get("default");
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

    app.get("/v1/:route", (res, req) => {
        res.writeHeader("Content-Type", "application/json");
        const routeName = req.getParameter(0);
        const params = new URLSearchParams(req.getQuery());
        const route = getRoutes.get(routeName) || getRoutes.get("default");
        const invalidParams = route.invalidParams(params);
        if (invalidParams) {
            res.send(route.jsonStringify("error", {
                message: invalidParams,
            }));
            return;
        }
        route.execute(res, params, aucklandTransportData);
    });

    app.any("/*", res => {
        res.writeStatus("404 Not Found");
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
            status:  "error",
            message: "404 Not Found",
        }));
    });

    app.listen(9001, listenSocket => {
        if (listenSocket) {
            console.log("Listening to port 9001");
        }
    });
})();
