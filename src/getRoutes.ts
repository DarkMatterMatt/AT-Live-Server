import GetRoute from "./GetRoute";

const routes = new Map<string, GetRoute>();

routes.set("default", new GetRoute("default")
    .setExecutor((route) => {
        return route.finish("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        });
    }));

routes.set("status", new GetRoute("status")
    .setCacheMaxAge(0)
    .setExecutor((route, { aucklandTransportData, activeWebSockets }) => {
        return route.finish("success", {
            websocketUpdates:     aucklandTransportData.webSocketActive(),
            livePollingUpdates:   aucklandTransportData.livePollingActive(),
            lastVehicleUpdate:    aucklandTransportData.getLastVehicleUpdate(),
            activeWebSockets:     activeWebSockets.size,
            version:              process.env.npm_package_version,
        });
    }));

routes.set("routes", new GetRoute("routes")
    .setExecutor((route, { params, aucklandTransportData }) => {
        const shortNames = params.get("shortNames") && params.get("shortNames").split(",");
        const fetchRaw = params.get("fetch");
        let fetch: string[];
        if (fetchRaw) {
            fetch = fetchRaw.split(",");
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
            route.setCacheMaxAge(0);
        }

        const processedRoutes = aucklandTransportData.getRoutesByShortName();
        const data: Record<string, any> = {};
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

        return route.finish("success", {
            message: "See routes attached",
            routes:  data,
        });
    }));

export default routes;
