module.exports = {
    env: {
        commonjs: true,
        es6: true,
        node: true,
    }, 
    parser: "@typescript-eslint/parser",
    plugins: [
        "@typescript-eslint"
    ],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    parserOptions: {
        ecmaVersion: 2018,
    },
    rules: {
        "array-bracket-spacing": ["error", "never"],
        "arrow-spacing": "error",
        "brace-style": ["error", "stroustrup"],
        "comma-dangle": ["error", {
            "arrays": "always-multiline",
            "objects": "always-multiline",
            "imports": "always-multiline",
            "exports": "always-multiline",
            "functions": "never",
        }],
        "eqeqeq": ["error", "smart"],
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/indent": ["warn", 4, {
            "SwitchCase": 1,
        }],
        "keyword-spacing": "error",
        "max-len": ["warn", {
            "code": 120,
            "comments": 100,
            "ignorePattern": "^\\s*import.*from.*;\\s*$", // ignore long imports
        }],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": ["warn", {
            "ignoreParameters": true,
        }],
        "no-mixed-operators": "error",
        "no-trailing-spaces": "error",
        "@typescript-eslint/no-unused-vars": ["error", {
            "argsIgnorePattern": "_+",
            "varsIgnorePattern": "_+",
        }],
        "object-curly-spacing": ["error", "always"],
        "operator-linebreak": ["error", "after"],
        "prefer-destructuring": "error",
        "prefer-template": "error",
        "quotes": ["error", "double", {
            "avoidEscape": true,
        }],
        "semi": ["error", "always"],
    },
};
