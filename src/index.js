const uWS = require("uWebSockets.js");
const C = require("./config");

const app = C.useSSL ? uWS.SSLApp(C.ssl) : uWS.App();

/* Subscribe / publish by route short names */

app.ws("/v1/", {
    ...C.ws.v1.opts,

    message: (ws, message, isBinary) => {
        const ok = ws.send(message, isBinary);
    },
});
app.listen(9001, (listenSocket) => {
    if (listenSocket) {
        console.log("Listening to port 9001");
    }
});
