import  { LocalStorage } from "node-localstorage";
import LZString from "lz-string";
import { isTruthy } from "./TruthyUserInput";
import logger from "./logger";

/** localStorage cache for JSON serialisable objects */
class Cache {
    private _localStorage: LocalStorage;
    private compress: boolean;

    constructor(cacheName: string, maxSizeInBytes: number, compress: boolean) {
        this._localStorage = new LocalStorage(`./localStorage/${cacheName}`, maxSizeInBytes);
        this.compress = isTruthy(compress);

        const prevCompress = JSON.parse(this._localStorage.getItem("_cache_option_compress"));
        if (prevCompress !== null && prevCompress !== this.compress) {
            logger.warn("LocalStorage compression method changed. Resetting cache");
            this.clear();
        }
        this._localStorage.setItem("_cache_option_compress", JSON.stringify(this.compress));
    }

    store(k: string, v: any): void {
        let tmp = JSON.stringify(v);
        if (this.compress) {
            tmp = LZString.compressToBase64(tmp);
        }
        try {
            this._localStorage.setItem(k, tmp);
        }
        catch (err) {
            logger.warn(`Cache: error while setting '${k}'`, err);
        }
    }

    load(k: string): any {
        let tmp = this._localStorage.getItem(k);
        if (tmp === null) {
            return null;
        }
        if (this.compress) {
            tmp = LZString.decompressFromBase64(tmp);
        }
        return JSON.parse(tmp);
    }

    remove(k: string): void {
        this._localStorage.removeItem(k);
    }

    clear(): void {
        this._localStorage.clear();
    }
}

export default Cache;
