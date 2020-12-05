/* eslint-disable func-names */
const WebSocketRoute = require("./WebSocketRoute");

const routes = new Map();

routes.set("default", new WebSocketRoute("default")
    // executor must not be an arrow function in order to get the correct `this`
    .setExecutor(function () {
        return this.finish("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        });
    }));

routes.set("ping", new WebSocketRoute("ping")
    .setExecutor(function () {
        return this.finish("success", {
            message: "pong",
        });
    }));

routes.set("subscribe", new WebSocketRoute("subscribe")
    .setRequiredParam("shortName")
    .setExecutor(function ({ ws, json, aucklandTransportData }) {
        const { shortName } = json;
        if (!aucklandTransportData.hasRouteByShortName(shortName)) {
            return this.finish("error", {
                message: `Unknown route with short name '${shortName}'.`,
            });
        }

        ws.subscribe(`${shortName}`);
        return this.finish("success", {
            message: `Subscribed to '${shortName}'.`,
            shortName,
        });
    }));

routes.set("unsubscribe", new WebSocketRoute("unsubscribe")
    .setRequiredParam("shortName")
    .setExecutor(function ({ ws, json, aucklandTransportData }) {
        const { shortName } = json;
        if (!aucklandTransportData.hasRouteByShortName(shortName)) {
            return this.finish("error", {
                message: `Unknown route with short name '${shortName}'.`,
            });
        }

        ws.unsubscribe(`${shortName}`);
        return this.finish("success", {
            message: `Unsubscribed from '${shortName}'.`,
            shortName,
        });
    }));

module.exports = routes;
