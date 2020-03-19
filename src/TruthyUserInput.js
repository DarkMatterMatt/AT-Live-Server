/**
 * TruthyUserInput converts user input to a boolean value.
 * @param {*} s Returns true if s is truthy.
 */
function TruthyUserInput(s) {
    if ([undefined, null, 0, false].includes(s)) {
        return false;
    }
    if (typeof s.toString === "function") {
        if (["", "null", "0", "false", "no", "n"].includes(s.toString().toLowerCase())) {
            return false;
        }
    }
    return true;
}

TruthyUserInput.isTruthy = s => TruthyUserInput(s);
TruthyUserInput.isFalsy = s => !TruthyUserInput(s);

module.exports = TruthyUserInput;
