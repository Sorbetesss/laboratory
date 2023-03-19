import * as coreOptions from "../main/core-options.evaluate.js";
import commonOptions from "../common/common-options.js";

const CATEGORY_JAVASCRIPT = "JavaScript";

// format based on https://github.com/prettier/prettier/blob/main/src/main/core-options.evaluate.js
const options = {
  arrowParens: {
    category: CATEGORY_JAVASCRIPT,
    type: "choice",
    default: "always",
    description: "Include parentheses around a sole arrow function parameter.",
    choices: [
      {
        value: "always",
        description: "Always include parens. Example: `(x) => x`",
      },
      {
        value: "avoid",
        description: "Omit parens when possible. Example: `x => x`",
      },
    ],
  },
  bracketSameLine: commonOptions.bracketSameLine,
  bracketSpacing: commonOptions.bracketSpacing,
  jsxBracketSameLine: {
    category: CATEGORY_JAVASCRIPT,
    type: "boolean",
    description: "Put > on the last line instead of at a new line.",
    deprecated: "2.4.0",
  },
  semi: {
    category: CATEGORY_JAVASCRIPT,
    type: "boolean",
    default: true,
    description: "Print semicolons.",
    oppositeDescription:
      "Do not print semicolons, except at the beginning of lines which may need them.",
  },
  singleQuote: commonOptions.singleQuote,
  jsxSingleQuote: {
    category: CATEGORY_JAVASCRIPT,
    type: "boolean",
    default: false,
    description: "Use single quotes in JSX.",
  },
  quoteProps: {
    category: CATEGORY_JAVASCRIPT,
    type: "choice",
    default: "as-needed",
    description: "Change when properties in objects are quoted.",
    choices: [
      {
        value: "as-needed",
        description: "Only add quotes around object properties where required.",
      },
      {
        value: "consistent",
        description:
          "If at least one property in an object requires quotes, quote all properties.",
      },
      {
        value: "preserve",
        description: "Respect the input use of quotes in object properties.",
      },
    ],
  },
  trailingComma: {
    category: CATEGORY_JAVASCRIPT,
    type: "choice",
    default: "all",
    description: "Print trailing commas wherever possible when multi-line.",
    choices: [
      {
        value: "all",
        description:
          "Trailing commas wherever possible (including function arguments).",
      },
      {
        value: "es5",
        description:
          "Trailing commas where valid in ES5 (objects, arrays, etc.)",
      },
      { value: "none", description: "No trailing commas." },
    ],
  },
  singleAttributePerLine: commonOptions.singleAttributePerLine,
  experimentalOperatorPosition: {
    category: coreOptions.CATEGORY_EXPERIMENTAL,
    type: "boolean",
    default: false,
    description:
      "Use experimental formatting for breaking lines before binary operators",
  },
};

export default options;
