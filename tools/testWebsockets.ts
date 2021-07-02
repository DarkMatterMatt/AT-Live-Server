// fix TS1208
export {};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import WebSocket from "ws";

// eslint-disable-next-line max-len
const POSSIBLE_ROUTES = ["18","20","30","31","32","33","35","66","68","70","75","82","83","101","105","106","110","111","112","114","120","122","125","126","128","129","131","132","133","134","138","141","142","143","146","152","154","161","162","170","171","172","186","191","195","209","220","252","253","295","298","309","313","314","321","323","324","325","326","349","351","352","353","355","361","362","363","365","366","371","372","373","376","377","378","380","391","392","393","394","395","396","398","399","400","401","402","410","411","412","413","414","415","416","417","418","419","420","421","425","426","427","428","430","431","432","433","434","435","436","437","439","440","441","442","443","444","500","501","502","504","505","510","511","512","514","515","516","519","520","521","522","523","524","525","530","531","540","541","542","543","544","545","546","547","548","549","550","568","650","670","711","712","714","728","729","733","734","735","739","743","744","747","751","755","762","774","775","781","782","783","801","802","806","807","813","814","842","843","845","856","861","865","866","871","878","883","884","885","889","890","901","906","907","917","923","924","926","928","931","933","939","941","942","966","981","982","983","984","985","986","987","988","995","996","997","998","24B","061","078","27H","NX1","WSTH","MTIA","005","97V","INN","089","015","051","132X","027","22A","95B","065","022","125X","72M","004","062","RAK","018","046","026","007","223X","PINE","009","003","012","013","50A","TMK","023","029","ONE","14W","EAST","059","079","27W","055","073","090","010","HOBS","24R","049","001","MEX","070","008","97R","053","025","014","031","056","037","25B","035","030","028","082","064","133X","054","032","22N","060","042","084","020","95C","074","NX2","019","017","OUT","044","036","050","033","002","97B","081","024","CTY","PUK","STH","080","243X","006","077","14T","041","040","248X","021","058","70H","097","072","WEST","27T","BIRK","309X","171X","151X","083","087","034","RBE","72C","066","095","016","24W","72X","25L","076","50B","038","091","HMB","067","069","N10","071","SBAY","096","172X","047","BAYS","048","GULF","221X","092","052","22R","045","088","057","093","95G","DEV","063","094","043","075","333X"];

if (process.argv.length !== 4) {
    console.log(`Usage: ${process.argv[1]} "wss://api.commute.live/v1/websocket" 750`);
    process.exit(1);
}

const [WS_URL, MAX_CONNS] = process.argv.slice(2);

const websockets: [WebSocket, number][] = [];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomInt = (max: number) => Math.floor(Math.random() * Math.floor(max));

const getRandomRoute = () => POSSIBLE_ROUTES[getRandomInt(POSSIBLE_ROUTES.length)];

console.log(`Connecting to ${WS_URL}`);

function log() {
    const now = Date.now();
    const created = websockets.length;
    const open = websockets.filter(w => w[1] > 0).length;
    const closed = websockets.filter(w => w[1] === -1).length;
    const stalled = websockets.filter(w => w[1] !== -1 && w[1] < now - 7500).length;

    console.log(`${WS_URL}; Created: ${created}; Open: ${open}; Closed: ${closed}; Stalled: ${stalled};`);
}

setInterval(log, 2000);

process.on("uncaughtException", console.error);

(async () => {
    for (let i = 0; i < Number.parseInt(MAX_CONNS); i++) {
        const ws = new WebSocket(WS_URL);
        websockets[i] = [ws, 0];
        let interval: NodeJS.Timeout;

        ws.addEventListener("open", () => {
            websockets[i][1] = Date.now();

            ws.send(`{"route":"subscribe","shortName":${getRandomRoute()}}`);
            ws.send(`{"route":"subscribe","shortName":${getRandomRoute()}}`);
            ws.send(`{"route":"subscribe","shortName":${getRandomRoute()}}`);

            interval = setInterval(() => {
                ws.send('{"route":"ping"}');
            }, 5000);
        });

        ws.addEventListener("message", () => {
            websockets[i][1] = Date.now();
        });

        ws.addEventListener("close", () => {
            websockets[i][1] = -1;
            clearInterval(interval);
        });

        await sleep(500);
    }
})();
