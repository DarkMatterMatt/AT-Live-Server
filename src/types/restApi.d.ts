interface ATQuerySuccess {
    status: "OK";
    response: any;
    error: null;
}

interface ATQueryError {
    status: "Error";
    response: null;
    error: {
        name: string;
        message: string;
    };
}

type ATQueryResult = ATQuerySuccess | ATQueryError;

interface ATTripRaw {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign: string;
    direction_id: 0 | 1;
    block_id: null;
    shape_id: string;
    trip_short_name: null;
    trip_type: null;
}

interface ATRouteRaw {
    route_id: string;
    agency_id: string;
    route_short_name: string;
    route_long_name: string;
    route_desc: null;
    route_type: number;
    route_url: null;
    route_color: null;
    route_text_color: null;
}

interface ATShapePointRaw {
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
    shape_dist_traveled: null;
}

interface ATVehicleRaw {
    trip: {
        trip_id: string;
        start_time: string;
        start_date: string;
        schedule_relationship: number;
        route_id: string;
        direction_id: 0 | 1;
    };
    position: {
        latitude: number;
        longitude: number;
        bearing: string;
        odometer: number;
        speed: number;
    };
    timestamp: number;
    vehicle: {
        id: string;
        label: string;
        license_plate: string;
    };
    occupancy_status: number;
}

interface ATVersionRaw {
    version: string;
    startdate: string;
    enddate: string;
}
