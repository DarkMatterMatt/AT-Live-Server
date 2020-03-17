module.exports = {
    useSSL: false,
    ssl:    {
        key_file_name:  "misc/key.pem",
        cert_file_name: "misc/cert.pem",
    },
    ws: {
        v1: {
            opts: {
                compression:      0,
                maxPayloadLength: 16 * 1024 * 1024,
                idleTimeout:      60,
            },
        },
    },
};
