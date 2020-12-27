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
