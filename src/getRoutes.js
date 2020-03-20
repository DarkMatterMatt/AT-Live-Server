/* eslint-disable func-names */
const Route = require("./Route");

const routes = new Map();

routes.set("default", new Route("default")
    // executor must not be an arrow function in order to get the correct `this`
    .setExecutor(function (res) {
        return res.end(this.jsonStringify("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        }));
    }));

routes.set("routes", new Route("routes")
    .setExecutor(function (res, params, aucklandTransportData) {
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

        const processedRoutes = aucklandTransportData.getRoutesByShortName();
        const data = {};

        for (const [shortName, processedRoute] of processedRoutes.entries()) {
            // skip unwanted routes
            if (shortNames && !shortNames.includes(shortName)) {
                continue;
            }
            data[shortName] = {};
            for (const f of fetch) {
                switch (f) {
                    default: break;

                    // copy primitives
                    case "shortName":
                    case "longName":
                    case "polylines":
                    case "type":
                    case "agencyId": {
                        data[shortName][f] = processedRoute[f];
                        break;
                    }

                    // copy Sets
                    case "longNames":
                    case "routeIds": {
                        data[shortName][f] = [...processedRoute[f]];
                        break;
                    }

                    case "shapeIds": {
                        const shapes0 = processedRoute[f][0];
                        const shapes1 = processedRoute[f][1];
                        data[shortName][f] = [[...shapes0], [...shapes1]];
                        break;
                    }

                    // copy Maps (of primitives)
                    case "vehicles": {
                        data[shortName][f] = Object.fromEntries(processedRoute[f].entries());
                        break;
                    }
                }
            }
        }

        return res.end(this.jsonStringify("success", {
            message: "See routes attached",
            routes:  data,
        }));
    }));

module.exports = routes;
