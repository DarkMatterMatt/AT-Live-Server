/* eslint-disable @typescript-eslint/ban-types */

import logger from "~/logger";
import { outputSnapDivisions } from "./snapDeviation";

export * from "./snapDeviation";

const MINUTE = 60 * 1000;

const enabledFunctions = new Map<Function, ReturnType<typeof setInterval>>();

export function enableLogging(fn: (...args: any[]) => void, intervalMs: number, ...args: any[]): void {
    if (enabledFunctions.has(fn)) {
        logger.warn(`Logging for this function is already enabled: ${fn.name}`);
        return;
    }
    const interval = setInterval(fn, intervalMs, ...args);
    enabledFunctions.set(fn, interval);
}

export function disableLogging(fn: Function): void {
    if (!enabledFunctions.has(fn)) {
        logger.warn(`Logging for this function is already disabled: ${fn.name}`);
        return;
    }
    enabledFunctions.delete(fn);
}

enableLogging(outputSnapDivisions, 10 * MINUTE, logger.verbose);
