// fix TS1208
export {};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import WebSocket from "ws";
import moment from "moment";

// check args

if (process.argv.length !== 2 + 2) {
    console.log(`Usage: ${process.argv[1]} "wss://mattm.win:8443/v1/websocket" "./output.jsonl"`);
    console.log(process.argv);
    process.exit(1);
}
const [WS_URL, OUTPUT_FILENAME_TEMPLATE] = process.argv.slice(2);

/* GLOBALS */

let ws: WebSocket | null = null;

let restartWebSocketTimeout: ReturnType<typeof setTimeout> | null = null;

let lastMessage = Date.now();

let logPath = "";

let stream: fs.WriteStream = null;

let loggedCount = 0;

function rotateLogFile() {
    const newLogPath = OUTPUT_FILENAME_TEMPLATE.replace(/(\{+[^}]+\}+)/g, match => {
        // trim {{  }}
        const formatStr = match.replace(/^[{}]+|[{}]+$/g, "");
        return moment().format(formatStr);
    }).replace(/[?%*:|"<>-]+/g, "-");
    if (newLogPath === logPath) {
        return;
    }
    logPath = newLogPath;
    const oldStream = stream;
    stream = fs.createWriteStream(logPath, { flags: "a" });
    if (oldStream != null) {
        oldStream.end();
    }
}

function setRestartWebSocketTimeout(ms = 2000) {
    clearTimeout(restartWebSocketTimeout);
    restartWebSocketTimeout = setTimeout(() => {
        start();
    }, ms);
}

function log(message: any) {
    const timestamp = Date.now();
    const json = JSON.stringify({
        timestamp,
        message,
    });
    stream.write(`${json}\n`);
    loggedCount++;
}

function start() {
    if (ws != null) {
        if (ws.readyState === ws.CONNECTING) {
            return;
        }
        if (ws.readyState === ws.OPEN) {
            ws.close();
        }
    }

    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
        console.info("WebSocket open");
        ws.send(JSON.stringify({
            // appears to be a stripped-down GraphQL API
            filters: { $or: { vehicle: true, tripUpdate: true } },
            query: "{ id vehicle tripUpdate }",
        }));
    });

    ws.on("message", data => {
        lastMessage = Date.now();
        log(data);
    });

    ws.on("close", () => {
        console.warn("WebSocket close");
        setRestartWebSocketTimeout(100);
    });
}

(async () => {
    rotateLogFile();
    setInterval(() => {
        rotateLogFile();
    }, 10 * 1000);

    setInterval(() => {
        if (lastMessage < Date.now() - 5000) {
            console.warn("No message received for 5 seconds, restarting websocket");
            setRestartWebSocketTimeout(0);
        }
    }, 100);

    setInterval(() => {
        console.log(`Logged a total of ${loggedCount} messages`);
    }, 10 * 60 * 1000);

    start();
})().catch(console.warn);
