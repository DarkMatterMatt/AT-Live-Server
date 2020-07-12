module.exports = {
    port:   9001,
    useSSL: false,
    ssl:    {
        key_file_name:  "misc/key.pem",
        cert_file_name: "misc/cert.pem",
    },
    ws: {
        v1: {
            opts: {
                compression:      false,
                maxPayloadLength: 16 * 1024 * 1024,
                idleTimeout:      60,
            },
        },
    },
    aucklandTransport: {
        key:                 "01234567890123456789012345678901",
        baseUrl:             "https://api.at.govt.nz/v2/",
        webSocketUrl:        "wss://mobile.at.govt.nz/streaming/realtime/locations?subscription_key=",
        maxParallelRequests: 10,
        maxCacheSizeInBytes: 100 * 1024 * 1024,
        compressCache:       false,
    },
    logger: {
        logFile: "combined.log",
        colors:  {
            error:   "redBright",
            warn:    "yellowBright",
            info:    "greenBright",
            verbose: "cyanBright",
        },
        // uncomment to completely override the default logger options in logger.js
        // opts: {}
    },
};
