import WebSocketRoute from "./WebSocketRoute";

const routes = new Map<string, WebSocketRoute>();

routes.set("default", new WebSocketRoute("default")
    .setExecutor((route) => {
        return route.finish("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        });
    }));

routes.set("ping", new WebSocketRoute("ping")
    .setExecutor((route) => {
        return route.finish("success", {
            message: "pong",
        });
    }));

routes.set("subscribe", new WebSocketRoute("subscribe")
    .setExecutor((route, { ws, json, aucklandTransportData }) => {
        const { shortName } = json;

        // check that shortName exists
        if (typeof shortName !== "string" || shortName === "") {
            return route.finish("error", {
                message: "Missing required parameter: 'shortName'.",
            });
        }

        if (shortName !== "#" && !aucklandTransportData.hasRouteByShortName(shortName)) {
            return route.finish("error", {
                message: `Unknown route with short name '${shortName}'.`,
            });
        }

        ws.subscribe(shortName);
        return route.finish("success", {
            message: `Subscribed to '${shortName}'.`,
            shortName,
        });
    }));

routes.set("unsubscribe", new WebSocketRoute("unsubscribe")
    .setExecutor((route, { ws, json, aucklandTransportData }) => {
        const { shortName } = json;

        // check that shortName exists
        if (typeof shortName !== "string" || shortName === "") {
            return route.finish("error", {
                message: "Missing required parameter: 'shortName'.",
            });
        }

        if (shortName !== "#" && !aucklandTransportData.hasRouteByShortName(shortName)) {
            return route.finish("error", {
                message: `Unknown route with short name '${shortName}'.`,
            });
        }

        ws.unsubscribe(`${shortName}`);
        return route.finish("success", {
            message: `Unsubscribed from '${shortName}'.`,
            shortName,
        });
    }));

export default routes;
