type UserInput = string | number | boolean | null | undefined;

/**
 * TruthyUserInput converts user input to a boolean value.
 * @param {*} s Returns true if s is truthy.
 */
export default function TruthyUserInput(s: UserInput): boolean {
    if (["", undefined, null, 0, false].includes(s)) {
        return false;
    }
    if (typeof s.toString === "function") {
        if (["", "null", "0", "false", "no", "n"].includes(s.toString().toLowerCase())) {
            return false;
        }
    }
    return true;
}

export const isTruthy = (s: UserInput) => TruthyUserInput(s);
export const isFalsy = (s: UserInput) => !TruthyUserInput(s);
