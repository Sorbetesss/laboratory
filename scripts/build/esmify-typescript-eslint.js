/* Transform `@typescript-eslint/*` module to ESM */

import * as path from "node:path";

import { outdent } from "outdent";

import { PROJECT_ROOT, writeFile } from "../utils/index.js";

function esmifyTypescriptEslint(text) {
  /*
  ```js
  const foo = __importStar(require("foo"));
  const foo = require("foo");
  ```
  ->
  ```js
  import * as foo from "foo";
  ````
  */
  text = text.replaceAll(
    // TODO: Use duplicate capture group name when eslint supports
    /(?<=\n)(?:const|let|var) (?<variable>\w+) = (?:__importStar\(require\(["'](?<moduleName1>.*?)["']\)\)|require\(["'](?<moduleName2>.*?)["']\));/g,
    (...args) => {
      const groups = args.at(-1);
      return `import * as ${groups.variable} from "${groups.moduleName1 || groups.moduleName2}";`;
    },
  );

  /*
  ```js
  const foo = __importDefault(require("foo"));
  ```
  ->
  ```js
  import foo_default_export from "foo";
  const foo = {default: foo_default_export};
  ````
  */
  text = text.replaceAll(
    /(?<=\n)(?:const|let|var) (?<variable>\w+) = __importDefault\(require\(["'](?<moduleName>.*?)["']\)\);/g,
    outdent`
      import $<variable>_default_export from "$<moduleName>";
      const $<variable> = {default: $<variable>_default_export};
    `,
  );

  text = text.replaceAll(
    'Object.defineProperty(exports, "__esModule", { value: true });',
    "",
  );
  text = text.replaceAll(/(?<=\n)(?:exports\.\w+ = )+void 0;/g, "");
  text = text.replaceAll(
    /(?<=\n)exports\.(?<specifier>\w+) = (?<variable>\w+);/g,
    (...args) => {
      const { variable, specifier } = args.at(-1);
      if (specifier === variable) {
        return `export {${specifier}};`;
      }

      return `export const ${specifier} = ${variable};`;
    },
  );

  text = text.replaceAll(
    /(?<=\n)exports\.(?<specifier>\w+)(?= = `)/g,
    "export const $<specifier>",
  );

  return text;
}

const NODE_MODULES_DIRECTORY = path.join(
  PROJECT_ROOT,
  "node_modules/@typescript-eslint/",
);
// Save modified code to `{PROJECT_ROOT}/.tmp/@typescript-eslint/` for debug
const saveToDisk = (process) => (text, file) => {
  if (!file.startsWith(NODE_MODULES_DIRECTORY)) {
    return text;
  }

  const code = process(text);

  writeFile(
    path.join(
      PROJECT_ROOT,
      ".tmp/@typescript-eslint-esm/",
      path.relative(NODE_MODULES_DIRECTORY, file),
    ),
    code,
  );

  return code;
};

export default saveToDisk(esmifyTypescriptEslint);
