const  { LocalStorage } = require("node-localstorage");

/** localStorage cache for JSON serialisable objects */
class Cache {
    constructor(cacheName, maxSizeInBytes) {
        this._localStorage = new LocalStorage(`./localStorage/${cacheName}`, maxSizeInBytes);
    }

    store(k, v) {
        const str = JSON.stringify(v);
        try {
            this._localStorage.setItem(k, str);
        }
        catch (err) {
            console.warn("LocalStorage may be full. Resetting cache");
            this.clear();
            this._localStorage.setItem(k, str);
        }
    }

    load(k) {
        return JSON.parse(this._localStorage.getItem(k));
    }

    remove(k) {
        this._localStorage.removeItem(k);
    }

    clear() {
        this._localStorage.clear();
    }
}

module.exports = Cache;
