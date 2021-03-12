import { expect } from "chai";
import CheapProjection, { AUCKLAND_COORDINATES } from "./CheapProjection";
import { mercatorProjection } from "./MercatorProjection";

const LocLatLng = (location: string, lat: number, lng: number) => ({ location, lat, lng });

function getErrorFromLatLngToPoint(proj: CheapProjection, latLng: LatLng): Point {
    const cheapPt = proj.fromLatLngToPoint(latLng);
    const mercPt = mercatorProjection.fromLatLngToPoint(latLng);
    return {
        x: (cheapPt.x - mercPt.x) / mercPt.x,
        y: (cheapPt.y - mercPt.y) / mercPt.y,
    };
}

function getErrorFromPointToLatLng(proj: CheapProjection, point: Point): LatLng {
    const cheapLatLng = proj.fromPointToLatLng(point);
    const mercLatLng = mercatorProjection.fromPointToLatLng(point);
    return {
        lng: 100 * (cheapLatLng.lng - mercLatLng.lng) / mercLatLng.lng,
        lat: 100 * (cheapLatLng.lat - mercLatLng.lat) / mercLatLng.lat,
    };
}

const akl_center = AUCKLAND_COORDINATES;
const akl_25km_coordinates = [
    LocLatLng("Auckland CBD", -36.841217629107256, 174.76648933202512),
    LocLatLng("Mount Wellington", -36.90785151068278, 174.83540673408774),
    LocLatLng("Mount Roskill", -36.908206000454605, 174.7385174145617),
    LocLatLng("Howick", -36.89247645041839, 174.92274180257357),
    LocLatLng("Albany", -36.729076703378226, 174.70072732410748),
    LocLatLng("Titirangi", -36.92333958537855, 174.65609760367389),
    LocLatLng("Waitakere", -36.8488104594454, 174.54184953290886),
    LocLatLng("Manurewa", -37.021146611576704, 174.8930012006804),
    LocLatLng("Awhitu", -37.11105449307762, 174.61415832436006),
    LocLatLng("Rangitoto Island", -36.78488360100111, 174.86188877479137),
    LocLatLng("Waiheke Island", -36.795820063945776, 175.09453026026145),
    LocLatLng("Helensville", -36.67382686738029, 174.4458413089377),
    LocLatLng("Huia", -37.001637207147176, 174.57326940037447),
    LocLatLng("Silverdale", -36.606771634491864, 174.67604615251557),
    LocLatLng("Pukekohe", -37.20442003899807, 174.90131249656477),
    LocLatLng("Waiuku", -37.25878426265453, 174.73822021890905),
];
const akl_25km_proj = new CheapProjection(akl_center, 25 * 1000);

describe("CheapProjection is accurate", () => {
    akl_25km_coordinates.forEach(locLatLng => {
        it(`fromLatLngToPoint(${locLatLng.location}) is accurate to 99.999%`, () => {
            const error = getErrorFromLatLngToPoint(akl_25km_proj, locLatLng);
            expect(error.x).closeTo(0, 1e-5);
            expect(error.y).closeTo(0, 1e-5);
        });
        it(`fromPointToLatLng(${locLatLng.location}) is accurate to 99%`, () => {
            akl_25km_coordinates.forEach(locLatLng => {
                const point = akl_25km_proj.fromLatLngToPoint(locLatLng);
                const error = getErrorFromPointToLatLng(akl_25km_proj, point);
                expect(error.lat).closeTo(0, 1e-2);
                expect(error.lng).closeTo(0, 1e-2);
            });
        });
    });
});
