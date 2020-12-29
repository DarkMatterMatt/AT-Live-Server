const snapDeviationDivisions = [
    0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    12, 14, 16, 18, 20,
    25, 30, 35, 40, 45, 50,
    60, 70, 80, 90, 100,
    120, 140, 160, 180, 200,
    250, 300, 350, 400, 450, 500,
    600, 700, 800, 900, 1000,
    1200, 1400, 1600, 1800, 2000,
    2500, 3000, 3500, 4000, 4500, 5000,
    999999,
];

const snapDeviations = new Array<number>(snapDeviationDivisions.length).fill(0);

export function logSnapDeviation(dist: number): void {
    for (let i = 0; i < snapDeviationDivisions.length; i++) {
        if (dist <= snapDeviationDivisions[i]) {
            snapDeviations[i]++;
            return;
        }
    }
}

export function getSnapDivisions(): Record<string, number> {
    const entries = snapDeviations
        .slice(1)
        .map((amount, i) => {
            const key = `${snapDeviationDivisions[i]} - ${snapDeviationDivisions[i + 1]}`;
            return [key, amount] as [string, number];
        });
    return Object.fromEntries(entries);
}

export function outputSnapDivisions(logFn: (message: string, ...meta: any[]) => any): void {
    logFn("outputSnapDivisions", getSnapDivisions());
}

/* Sample output for ~2.5 million vehicle updates (28 Dec 2020)
{
    '0 - 0.5': 198354,
    '0.5 - 1': 197889,
    '1 - 2': 374012,
    '2 - 3': 316745,
    '3 - 4': 245388,
    '4 - 5': 179584,
    '5 - 6': 129489,
    '6 - 7': 92465,
    '7 - 8': 65394,
    '8 - 9': 46518,
    '9 - 10': 34006,
    '10 - 12': 46343,
    '12 - 14': 32321,
    '14 - 16': 26235,
    '16 - 18': 22294,
    '18 - 20': 19167,
    '20 - 25': 39099,
    '25 - 30': 29819,
    '30 - 35': 23160,
    '35 - 40': 18694,
    '40 - 45': 16666,
    '45 - 50': 14106,
    '50 - 60': 24670,
    '60 - 70': 20842,
    '70 - 80': 18135,
    '80 - 90': 15046,
    '90 - 100': 12715,
    '100 - 120': 21304,
    '120 - 140': 16717,
    '140 - 160': 15049,
    '160 - 180': 10513,
    '180 - 200': 8098,
    '200 - 250': 15616,
    '250 - 300': 12409,
    '300 - 350': 9253,
    '350 - 400': 7691,
    '400 - 450': 8152,
    '450 - 500': 6166,
    '500 - 600': 10104,
    '600 - 700': 7996,
    '700 - 800': 5821,
    '800 - 900': 5632,
    '900 - 1000': 3746,
    '1000 - 1200': 6689,
    '1200 - 1400': 5677,
    '1400 - 1600': 6335,
    '1600 - 1800': 6250,
    '1800 - 2000': 4471,
    '2000 - 2500': 7189,
    '2500 - 3000': 6027,
    '3000 - 3500': 4417,
    '3500 - 4000': 3929,
    '4000 - 4500': 3965,
    '4500 - 5000': 2932,
    '5000 - 999999': 20805,
}
*/
