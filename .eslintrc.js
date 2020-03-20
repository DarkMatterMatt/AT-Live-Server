module.exports = {
    env: {
        commonjs: true,
        es6: true,
        node: true,
    },
    extends: [
        'airbnb-base',
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parserOptions: {
        ecmaVersion: 2018,
    },
    rules: {
        "arrow-parens": "off",
        "brace-style": ["warn", "stroustrup"],
        "comma-dangle": ["warn", {
            "arrays": "always-multiline",
            "objects": "always-multiline",
            "imports": "always-multiline",
            "exports": "always-multiline",
            "functions": "never",
        }],
        "indent": ["warn", 4, {
            "SwitchCase": 1
        }],
        "key-spacing": ["warn", {
            "mode": "minimum",
            "align": "value",
        }],
        "max-len": ["warn", {
            "code": 120
        }],
        "no-bitwise": "off",
        "no-console": "off",
        "no-continue": "off",
        "no-multi-spaces": "off",
        "no-plusplus": ["error", {
            "allowForLoopAfterthoughts": true
        }],
        "no-restricted-syntax": "off",
        "no-underscore-dangle": "off",
        "no-unused-vars": ["warn", {
            "argsIgnorePattern": "^_+$",
        }],
        "object-curly-newline": ["warn", {
            "consistent": true
        }],
        "quotes": ["warn", "double"],
    },
};
