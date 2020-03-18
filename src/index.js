const uWS = require("uWebSockets.js");
const AucklandTransportData = require("./AucklandTransportData");
const C = require("./config");

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

/* Subscribe / publish by route short names */
const aucklandTransportData = new AucklandTransportData(C.aucklandTransport.key, C.aucklandTransport.baseUrl);

(async () => {
    await aucklandTransportData.lookForUpdates("forceLoad");

    app.ws("/v1/", {
        ...C.ws.v1.opts,

        message: (ws, message, isBinary) => {
            const ok = ws.send(message, isBinary);
        },
    });

    app.get("/v1/:shortName", (res, req) => {
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

    app.any("/*", (res, req) => {
        res.end("Invalid endpoint");
    });

    app.listen(9001, (listenSocket) => {
        if (listenSocket) {
            console.log("Listening to port 9001");
        }
    });
})();
