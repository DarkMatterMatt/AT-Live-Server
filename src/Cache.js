const  { LocalStorage } = require("node-localstorage");
const LZString = require("lz-string");

/** localStorage cache for JSON serialisable objects */
class Cache {
    constructor(cacheName, maxSizeInBytes, compress) {
        this._localStorage = new LocalStorage(`./localStorage/${cacheName}`, maxSizeInBytes);
        this.compress = compress;

        const prevCompress = JSON.parse(this._localStorage.getItem("compress"));
        if (prevCompress !== null && prevCompress !== compress) {
            console.warn("LocalStorage compression method changed. Resetting cache");
            this.clear();
        }
        this._localStorage.setItem("__!compress!__", JSON.stringify(compress));
    }

    store(k, v) {
        let tmp = JSON.stringify(v);
        if (this.compress) {
            tmp = LZString.compressToBase64(tmp);
        }
        try {
            this._localStorage.setItem(k, tmp);
        }
        catch (err) {
            console.warn("LocalStorage may be full. Resetting cache");
            this.clear();
            this._localStorage.setItem(k, tmp);
        }
    }

    load(k) {
        let tmp = this._localStorage.getItem(k);
        if (tmp === null) {
            return null;
        }
        if (this.compress) {
            tmp = LZString.decompressFromBase64(tmp);
        }
        return JSON.parse(tmp);
    }

    remove(k) {
        this._localStorage.removeItem(k);
    }

    clear() {
        this._localStorage.clear();
    }
}

module.exports = Cache;
