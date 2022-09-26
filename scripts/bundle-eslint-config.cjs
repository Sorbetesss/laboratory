"use strict";

const targets = require("../package.json").browserslist;

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
  },
  settings: {
    targets,
    lintAllEsApis: true,
    polyfills: [
      // These are not really polyfilled, but seems safe to use in target browsers
      "BigInt",
      "Symbol.asyncIterator",
    ],
  },
  plugins: ["compat"],
  overrides: [
    {
      files: ["**/*.mjs"],
      parserOptions: {
        sourceType: "module",
      },
    },
    {
      files: [
        "doc.js",
        "doc.mjs",
        "standalone.js",
        "standalone.mjs",
        "plugins/*",
      ],
      env: {
        browser: true,
      },
      rules: {
        "compat/compat": "error",
        "no-restricted-syntax": [
          "error",
          // Forbid `require()`
          {
            selector: 'CallExpression[callee.name="require"]',
            message:
              "Universal bundles should not include any `require()` call.",
          },
          {
            selector:
              ":matches(ImportDeclaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration)",
            message:
              "Universal bundles should not include any `import`/`export` declaration.",
          },
          {
            selector: "ImportExpression",
            message: "Universal bundles should not include any `import()`.",
          },
        ],
      },
    },
    {
      files: ["index.cjs", "index.mjs", "bin/*", "internal/*"],
      rules: {
        "no-restricted-syntax": [
          "error",
          // Forbid top level `require()` parsers
          {
            selector:
              'CallExpression:not(:function *)[callee.name="require"][arguments.0.value=/plugins/]',
            message: "Parsers should be inline `require()`d.",
          },
          // Forbid top level `import()` parsers
          {
            selector:
              "ImportExpression:not(:function *)[source.value=/plugins/]",
            message: "Parsers should be inline `import()`ed.",
          },
          // Forbid `import`/`export` parsers
          {
            selector:
              ":matches(ImportDeclaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration)[source.value=/plugins/]",
            message: "Parsers should be inline `import()`ed.",
          },
        ],
      },
    },
    {
      files: ["bin/prettier.cjs"],
      parserOptions: {
        ecmaVersion: 5,
      },
      rules: {
        "compat/compat": "error",
      },
    },
  ],
};
