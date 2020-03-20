/* eslint-disable func-names */
const Route = require("./Route");

const routes = new Map();

routes.set("default", new Route("default")
    // executor must not be an arrow function in order to get the correct `this`
    .setExecutor(function (ws) {
        return ws.send(this.jsonStringify("error", {
            message: `Invalid route. Must be one of ${[...routes.keys()].join(", ")}.`,
        }));
    }));

routes.set("ping", new Route("ping")
    .setExecutor(function (ws) {
        return ws.send(this.jsonStringify("success", {
            message: "pong",
        }));
    }));

routes.set("subscribe", new Route("subscribe")
    .setRequiredParam("shortName")
    .setExecutor(function (ws, json, aucklandTransportData) {
        const { shortName } = json;
        if (!aucklandTransportData.hasRouteByShortName(shortName)) {
            return ws.send(this.jsonStringify("error", {
                message: `Unknown route with short name '${shortName}'.`,
            }));
        }

        ws.subscribe(`${shortName}`);
        return ws.send(this.jsonStringify("success", {
            message: `Subscribed to '${shortName}'.`,
            shortName,
        }));
    }));

routes.set("unsubscribe", new Route("unsubscribe")
    .setRequiredParam("shortName")
    .setExecutor(function (ws, json, aucklandTransportData) {
        const { shortName } = json;
        if (!aucklandTransportData.hasRouteByShortName(shortName)) {
            return ws.send(this.jsonStringify("error", {
                message: `Unknown route with short name '${shortName}'.`,
            }));
        }

        ws.unsubscribe(`${shortName}`);
        return ws.send(this.jsonStringify("success", {
            message: `Unsubscribed from '${shortName}'.`,
            shortName,
        }));
    }));

module.exports = routes;
