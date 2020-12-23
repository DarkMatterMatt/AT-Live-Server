/**
 * Return unique values in array.
 */
export function unique<T>(arr: T[]): T[] {
    return [...new Set(arr)];
}

/**
 * Filters array by async function.
 * @param arr array to filter
 * @param fn callback filter function
 */
export async function filter<T>(arr: T[], fn: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<T[]> {
    const fail = Symbol();
    const results = await Promise.all(arr.map(
        async (item, i) => await fn(item, i, arr) ? item : fail
    ));
    return results.filter((i): i is T => i !== fail);
}

/**
 * Maps array by async function.
 * @param arr array to map
 * @param fn callback map function
 */
export async function map<T, R>(arr: T[], fn: (value: T, index: number, array: T[]) => Promise<R>): Promise<R[]> {
    return Promise.all(arr.map(async (item, i) => await fn(item, i, arr)));
}

/**
 * Removes first occurance of value. Mutates original array.
 * @param arr array to mutate and remove value from
 * @param value value to remove
 */
export function removeOne<T>(arr: T[], value: T): void {
    const index = arr.indexOf(value);
    if (index > -1) {
        arr.splice(index, 1);
    }
}

/**
 * Removes all occurances of value. Mutates original array.
 * @param arr array to mutate and remove value from
 * @param value value to remove
 */
export function removeAll<T>(arr: T[], value: T): void {
    let i = 0;
    while (i < arr.length) {
        if (arr[i] === value) {
            arr.splice(i, 1);
        }
        else {
            ++i;
        }
    }
}
