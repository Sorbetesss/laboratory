import path from "node:path";
import { createRequire } from "node:module";
import createEsmUtils from "esm-utils";
import { PROJECT_ROOT } from "../utils/index.mjs";

const { require, dirname } = createEsmUtils(import.meta);

/**
 * @typedef {Object} Bundle
 * @property {string} input - input of the bundle
 * @property {string?} output - path of the output file in the `dist/` folder
 * @property {string?} name - name for the UMD bundle (for plugins, it'll be `prettierPlugins.${name}`)
 * @property {'node' | 'universal'} target - should generate a CJS only for node or universal bundle
 * @property {'core' | 'plugin'} type - it's a plugin bundle or core part of prettier
 * @property {string[]} external - array of paths that should not be included in the final bundle
 * @property {object[]} replaceModule - Module replacements
 * @property {string[]} babelPlugins - babel plugins
 * @property {boolean?} minify - minify
 * @property {string[]?} esbuildTarget - ESBuild target
 * @property {boolean?} interopDefault - Should export the ESM default export

 * @typedef {Object} CommonJSConfig
 * @property {string[]} ignore - paths of CJS modules to ignore
 */

/*
`diff` use deprecated folder mapping "./" in the "exports" field,
so we can't `require("diff/lib/diff/array.js")` directly.
To reduce the bundle size, replace the entry with smaller files.

We can switch to deep require once https://github.com/kpdecker/jsdiff/pull/351 get merged
*/
const diffPackageDirectory = path.dirname(require.resolve("diff/package.json"));
const replaceDiffPackageEntry = (file) => ({
  module: path.join(diffPackageDirectory, "lib/index.mjs"),
  path: path.join(diffPackageDirectory, file),
});

/** @type {Bundle[]} */
const parsers = [
  {
    input: "src/language-js/parse/babel.js",
  },
  {
    input: "src/language-js/parse/flow.js",
    replaceModule: [
      // `flow-parser` use this for `globalThis`, can't work in strictMode
      {
        module: require.resolve("flow-parser"),
        find: "(function(){return this}())",
        replacement: "(globalThis)",
      },
    ],
  },
  {
    input: "src/language-js/parse/typescript.js",
    replaceModule: [
      // `@typescript-eslint/typescript-estree` v4
      {
        module: "*",
        find: 'require("globby")',
        replacement: "{}",
      },
      {
        module: "*",
        find: "extra.projects = prepareAndTransformProjects(",
        replacement: "extra.projects = [] || prepareAndTransformProjects(",
      },
      {
        module: "*",
        find: "process.versions.node",
        replacement: JSON.stringify("999.999.999"),
      },
      {
        module: "*",
        find: "process.cwd()",
        replacement: JSON.stringify("/prettier-security-dirname-placeholder"),
      },
      {
        module: "*",
        find: 'require("perf_hooks")',
        replacement: "{}",
      },
      {
        module: "*",
        find: 'require("inspector")',
        replacement: "{}",
      },
      {
        module: "*",
        find: "typescriptVersionIsAtLeast[version] = semverCheck(version);",
        replacement: "typescriptVersionIsAtLeast[version] = true;",
      },
      // The next two replacement fixed webpack warning `Critical dependency: require function is used in a way in which dependencies cannot be statically extracted`
      // #12338
      {
        module: require.resolve(
          "@typescript-eslint/typescript-estree/dist/create-program/shared.js"
        ),
        find: "moduleResolver = require(moduleResolverPath);",
        replacement: "throw new Error('Dynamic require is not supported');",
      },
      {
        module: require.resolve("typescript"),
        process(text) {
          // Remove useless `ts.sys`
          text = text.replace(
            /(?<=\n)(?<indentString>\s+)ts\.sys = \(function \(\) {.*?\n\k<indentString>}\)\(\);(?=\n)/s,
            ""
          );

          text = text.replace(
            /(?<=\n)(?<indentString>\s+)function tryGetNodePerformanceHooks\(\) {.*?\n\k<indentString>}(?=\n)/s,
            "function tryGetNodePerformanceHooks() {}"
          );

          return text;
        },
      },
      // yarn pnp
      {
        module: require.resolve("typescript"),
        find: "process.versions.pnp",
        replacement: "undefined",
      },

      ...Object.entries({
        // `typescript/lib/typescript.js` expose extra global objects
        // `TypeScript`, `toolsVersion`, `globalThis`
        'typeof process === "undefined" || process.browser': "false",
        'typeof globalThis === "object"': "true",

        "_fs.realpathSync.native":
          "_fs.realpathSync && _fs.realpathSync.native",

        // Remove useless language service
        "ts.realizeDiagnostics = ": "ts.realizeDiagnostics = undefined && ",
        "ts.TypeScriptServicesFactory = ":
          "ts.TypeScriptServicesFactory = undefined && ",
        "var ShimBase = ": "var ShimBase = undefined && ",
        "var TypeScriptServicesFactory = ":
          "var TypeScriptServicesFactory = undefined && ",
        "var LanguageServiceShimObject = ":
          "var LanguageServiceShimObject = undefined && ",
        "var CoreServicesShimHostAdapter = ":
          "var CoreServicesShimHostAdapter = undefined && ",
        "var LanguageServiceShimHostAdapter = ":
          "var LanguageServiceShimHostAdapter = undefined && ",
        "var ScriptSnapshotShimAdapter = ":
          "var ScriptSnapshotShimAdapter = undefined && ",
        "var ClassifierShimObject = ":
          "var ClassifierShimObject = undefined && ",
        "var CoreServicesShimObject = ":
          "var CoreServicesShimObject = undefined && ",
        "function simpleForwardCall(": "0 && function simpleForwardCall(",
        "function forwardJSONCall(": "0 && function forwardJSONCall(",
        "function forwardCall(": "0 && function forwardCall(",
        "function realizeDiagnostics(": "0 && function realizeDiagnostics(",
        "function realizeDiagnostic(": "0 && function realizeDiagnostic(",
        "function convertClassifications(":
          "0 && function convertClassifications(",

        // Dynamic `require()`s
        "ts.sys && ts.sys.require": "false",
        "require(etwModulePath)": "undefined",
        'require("source-map-support").install()': "",
        "require(modulePath)": "undefined",
      }).map(([find, replacement]) => ({
        module: require.resolve("typescript"),
        find,
        replacement,
      })),
      {
        module: require.resolve("debug/src/browser.js"),
        path: path.join(dirname, "./shims/debug.js"),
      },
    ],
  },
  {
    input: "src/language-js/parse/acorn-and-espree.js",
    name: "prettierPlugins.espree",
    // TODO: Rename this file to `parser-acorn-and-espree.js` or find a better way
    output: "parser-espree.js",
    replaceModule: [
      {
        module: require.resolve("espree"),
        find: "const Syntax = (function() {",
        replacement: "const Syntax = undefined && (function() {",
      },
      {
        module: require.resolve("espree"),
        find: "var visitorKeys = require('eslint-visitor-keys');",
        replacement: "var visitorKeys;",
      },
    ],
  },
  {
    input: "src/language-js/parse/meriyah.js",
  },
  {
    input: "src/language-js/parse/angular.js",
    replaceModule: [
      {
        module: "*",
        find: 'require("@angular/compiler/src/',
        replacement: 'require("@angular/compiler/esm2015/src/',
      },
    ],
  },
  {
    input: "src/language-css/parser-postcss.js",
    replaceModule: [
      // `postcss-values-parser` uses constructor.name, it will be changed by bundler
      // https://github.com/shellscape/postcss-values-parser/blob/c00f858ab8c86ce9f06fdb702e8f26376f467248/lib/parser.js#L499
      {
        module: require.resolve("postcss-values-parser/lib/parser.js"),
        find: "node.constructor.name === 'Word'",
        replacement: "node.type === 'word'",
      },
      // The following two replacements prevent load `source-map` module
      {
        module: path.join(
          require.resolve("postcss/package.json"),
          "lib/previous-map.js"
        ),
        text: "module.exports = class {};",
      },
      {
        module: path.join(
          require.resolve("postcss/package.json"),
          "lib/postcss/lib/map-generator.js"
        ),
        text: "module.exports = class { generate() {} };",
      },
    ],
  },
  {
    input: "src/language-graphql/parser-graphql.js",
  },
  {
    input: "src/language-markdown/parser-markdown.js",
    replaceModule: [
      {
        module: require.resolve("parse-entities/decode-entity.browser.js"),
        path: require.resolve("parse-entities/decode-entity.js"),
      },
    ],
  },
  {
    input: "src/language-handlebars/parser-glimmer.js",
    replaceModule: [
      // See comment in `src/language-handlebars/parser-glimmer.js` file
      {
        module: require.resolve(
          "@glimmer/syntax/dist/commonjs/es2017/lib/parser/tokenizer-event-handlers.js"
        ),
        path: require.resolve(
          "@glimmer/syntax/dist/modules/es2017/lib/parser/tokenizer-event-handlers.js"
        ),
      },
    ],
  },
  {
    input: "src/language-html/parser-html.js",
  },
  {
    input: "src/language-yaml/parser-yaml.js",
  },
].map((bundle) => {
  const { name } = bundle.input.match(
    /(?:parser-|parse\/)(?<name>.*?)\.js$/
  ).groups;

  return {
    type: "plugin",
    target: "universal",
    name: `prettierPlugins.${name}`,
    output: `parser-${name}.js`,
    ...bundle,
  };
});

/** @type {Bundle[]} */
const coreBundles = [
  {
    input: "src/index.js",
    interopDefault: false,
    replaceModule: [
      {
        module: require.resolve("@iarna/toml/lib/toml-parser.js"),
        find: "const utilInspect = eval(\"require('util').inspect\")",
        replacement: "const utilInspect = require('util').inspect",
      },
      // `editorconfig` use a older version of `semver` and only uses `semver.gte`
      {
        module: require.resolve("editorconfig"),
        find: 'var semver = __importStar(require("semver"));',
        replacement: `
          var semver = {
            gte: require(${JSON.stringify(
              require.resolve("semver/functions/gte")
            )})
          };
        `,
      },
      {
        module: require.resolve("n-readlines"),
        find: "const readBuffer = new Buffer(this.options.readChunk);",
        replacement: "const readBuffer = Buffer.alloc(this.options.readChunk);",
      },
      replaceDiffPackageEntry("lib/diff/array.js"),
    ],
  },
  {
    input: "src/document/index.js",
    interopDefault: false,
    name: "doc",
    output: "doc.js",
    target: "universal",
    format: "umd",
    minify: false,
  },
  {
    input: "src/standalone.js",
    interopDefault: false,
    name: "prettier",
    target: "universal",
    replaceModule: [
      {
        module: require.resolve("@babel/highlight"),
        path: path.join(dirname, "./shims/babel-highlight.js"),
      },
      {
        module: createRequire(require.resolve("vnopts")).resolve("chalk"),
        path: path.join(dirname, "./shims/chalk.js"),
      },
      replaceDiffPackageEntry("lib/diff/array.js"),
    ],
  },
  {
    input: "bin/prettier.cjs",
    output: "bin-prettier.js",
    esbuildTarget: ["node0.10"],
    replaceModule: [
      {
        module: path.join(PROJECT_ROOT, "bin/prettier.cjs"),
        process: (text) => text.replace('"../src/cli/index.js"', '"./cli.mjs"'),
      },
    ],
  },
  {
    input: "src/cli/index.js",
    output: "cli.mjs",
    format: "esm",
    external: ["benchmark"],
    interopDefault: false,
    replaceModule: [replaceDiffPackageEntry("lib/patch/create.js")],
  },
  {
    input: "src/common/third-party.js",
    replaceModule: [
      // cosmiconfig@6 -> import-fresh can't find parentModule, since module is bundled
      {
        module: require.resolve("parent-module"),
        path: path.join(dirname, "./shims/parent-module.cjs"),
      },
    ],
  },
].map((bundle) => ({
  type: "core",
  target: "node",
  output: path.basename(bundle.input),
  ...bundle,
}));

const configs = [...coreBundles, ...parsers];
export default configs;
