/* eslint-disable func-names */
const GetRoute = require("./GetRoute");

const routes = new Map();

routes.set("default", new GetRoute("default")
    // executor must not be an arrow function in order to get the correct `this`
    .setExecutor(function () {
        return this.finish("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        });
    }));

routes.set("status", new GetRoute("status")
    .setCacheMaxAge(0)
    .setExecutor(function ({ aucklandTransportData }) {
        return this.finish("success", {
            websocketUpdates:     aucklandTransportData.webSocketActive(),
            livePollingUpdates:   aucklandTransportData.livePollingActive(),
            lastMessageTimestamp: aucklandTransportData.lastMessageTimestamp(),
        });
    }));

routes.set("routes", new GetRoute("routes")
    .setExecutor(function ({ params, aucklandTransportData }) {
        const shortNames = params.get("shortNames") && params.get("shortNames").split(",");
        let fetch = params.get("fetch");
        if (fetch) {
            fetch = fetch.split(",");
        }
        else {
            fetch = ["shortName", "longName", "longNames", "routeIds", "shapeIds", "vehicles", "type", "agencyId"];
            // polylines are huge, don't send by default (unless specific routes are requested)
            if (shortNames) {
                fetch.push("polylines");
            }
        }

        // don't cache responses containing vehicles
        if (fetch.includes("vehicles")) {
            this.setCacheMaxAge(0);
        }

        const processedRoutes = aucklandTransportData.getRoutesByShortName();
        const data = {};
        const correctCapitalization = [
            "shortName", "longName", "polylines", "type", "agencyId", "longNames", "routeIds", "shapeIds", "vehicles",
        ];

        for (const [shortName, processedRoute] of processedRoutes.entries()) {
            // skip unwanted routes
            if (shortNames && !shortNames.includes(shortName)) {
                continue;
            }
            data[shortName] = {};
            for (const f of fetch) {
                const cc = correctCapitalization.find(x => x.toLowerCase() === f.toLowerCase());
                if (cc === undefined) {
                    continue;
                }

                switch (cc) {
                    default: break;

                    // copy primitives
                    case "shortName":
                    case "longName":
                    case "polylines":
                    case "type":
                    case "agencyId": {
                        data[shortName][f] = processedRoute[cc];
                        break;
                    }

                    // copy Sets
                    case "longNames":
                    case "routeIds": {
                        data[shortName][f] = [...processedRoute[cc]];
                        break;
                    }

                    case "shapeIds": {
                        data[shortName][f] = [
                            Object.fromEntries(processedRoute[cc][0].entries()),
                            Object.fromEntries(processedRoute[cc][1].entries()),
                        ];
                        break;
                    }

                    // copy Maps (of primitives)
                    case "vehicles": {
                        data[shortName][f] = Object.fromEntries(processedRoute[cc].entries());
                        break;
                    }
                }
            }
        }

        return this.finish("success", {
            message: "See routes attached",
            routes:  data,
        });
    }));

module.exports = routes;
