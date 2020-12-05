class Route {
    constructor(name) {
        this._name = name;
        this._requiredParams = [];
        this._defaultParams = {};
        this._paramPreprocessors = {};
        this._validParamValues = {};
        this._executor = () => {};
    }

    setRequiredParam(...params) {
        this._requiredParams = params;
        return this;
    }

    setDefaultParams(params) {
        this._defaultParams = params;
        return this;
    }

    setParamPreprocessor(param, preprocessor) {
        this._paramPreprocessors[param] = preprocessor;
        return this;
    }

    setValidParamValues(param, valid) {
        this._validParamValues[param] = valid;
        return this;
    }

    setExecutor(fn) {
        this._executor = fn;
        return this;
    }

    invalidParams(params) {
        for (const param of this._requiredParams) {
            if (params[param] === undefined) {
                return `Missing required parameter: '${param}'.`;
            }
        }
        const paramsWithDefaults = { ...this._defaultParams, ...params };
        for (const [param, value] of Object.entries(paramsWithDefaults)) {
            if (this._validParamValues[param] !== undefined && !this._validParamValues[param].includes(value)) {
                return `Invalid value for ${param}. Must be one of ${this._validParamValues[param].join(", ")}.`;
            }
        }

        return false;
    }

    execute(...args) {
        this._executor(...args);
    }

    // eslint-disable-next-line class-methods-use-this
    finish() {
        throw new Error("Stub");
    }
}

module.exports = Route;
