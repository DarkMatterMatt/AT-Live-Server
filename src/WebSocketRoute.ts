const Route = require("./Route");

class WebSocketRoute extends Route {
    constructor(...args) {
        super(...args);

        // reset every request
        this._ws = null;
    }

    execute(data, ...args) {
        this._ws = data.ws;
        this._executor(data, ...args);
    }

    finish(status, data) {
        const json = JSON.stringify({
            ...data,
            status,
            route: this._name,
        });
        this._ws.send(json);

        this._ws = null;
    }
}

module.exports = WebSocketRoute;
