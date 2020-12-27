interface Config {
    port: number;
    useSSL: boolean;
    ssl?: {
        key_file_name: string;
        cert_file_name: string;
    };
    ws: {
        v1: {
            opts: {
                compression: boolean;
                maxPayloadLength: number;
                idleTimeout: number;
            };
        };
    };
    aucklandTransport: AucklandTransportDataOpts;
    logger: {
        logFile?: string;
        logLevel?: string;
        colors?: Record<string, any>;
        opts?: Record<string, any>;
    };
}

interface AucklandTransportDataOpts {
    baseUrl: string;
    compressCache: boolean;
    key: string;
    livePollingInterval?: number;
    maxCacheSizeInBytes: number;
    maxParallelRequests?: number;
    webSocketUrl: string;
}

type Pixel = Point;

interface LatLng {
    lat: number;
    lng: number;
}

interface LatLngPixel extends LatLng, Point {}

interface PolylineLatLng extends LatLng {
    /** distance travelled from start of route, in meters */
    dist: number;
}

interface PolylineLatLngPixel extends PolylineLatLng, LatLngPixel {}

interface ATVehicleUnprocessed {
    routeId: string;
    directionId: 0 | 1;
    lastUpdatedUnix: number;
    position: LatLng;
    vehicleId: string;
    occupancyStatus: number;
}

interface ATVehicle {
    routeId: string;
    directionId: 0 | 1;
    lastUpdated: number;
    position: LatLng;
    vehicleId: string;
    occupancyStatus: number;
    snapPosition: LatLng;
    snapDiviation: number;
}

interface ATRoute {
    agencyId: string;
    longName: string;
    longNames: Set<string>;
    polylines: [PolylineLatLngPixel[], PolylineLatLngPixel[]];
    routeIds: Set<string>;
    shapeIds: [Map<string, number>, Map<string, number>];
    shortName: string;
    type: TransitType;
    vehicles: Map<ATVehicle["vehicleId"], ATVehicle>;
}

interface ATVersion {
    enddate: string;
    startdate: string;
    version: string;
}

type TransitType = "rail" | "bus" | "ferry";

interface Point {
    x: number;
    y: number;
}

interface MapProjection {
    fromPointToLatLng(pixel: Point, nowrap?: boolean): LatLng;
    fromLatLngToPoint(latLng: LatLng): Point;
}
