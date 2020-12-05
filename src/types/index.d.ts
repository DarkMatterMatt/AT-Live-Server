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

interface LatLng {
    lat: number;
    lng: number;
}

interface ATVehicle {
    routeId: string;
    directionId: 0 | 1;
    lastUpdatedUnix: number;
    position: LatLng;
    vehicleId: string;
    occupancyStatus: number;
}

interface ATRoute {
    agencyId: string;
    longName: string;
    longNames: Set<string>;
    polylines: [LatLng[], LatLng[]];
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