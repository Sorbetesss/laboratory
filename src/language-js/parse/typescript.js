import { parseWithNodeMaps } from "@typescript-eslint/typescript-estree/dist/parser.js";
import isTsxFile from "../utils/is-tsx-file.js";
import createError from "../../common/parser-create-error.js";
import tryCombinations from "../../utils/try-combinations.js";
import createParser from "./utils/create-parser.js";
import replaceHashbang from "./utils/replace-hashbang.js";
import postprocess from "./postprocess/index.js";
import { throwErrorForInvalidNodes } from "./postprocess/typescript.js";

/** @type {import("@typescript-eslint/typescript-estree").TSESTreeOptions} */
const parseOptions = {
  // `jest@<=26.4.2` rely on `loc`
  // https://github.com/facebook/jest/issues/10444
  // Set `loc` and `range` to `true` also prevent AST traverse
  // https://github.com/typescript-eslint/typescript-eslint/blob/733b3598c17d3a712cf6f043115587f724dbe3ef/packages/typescript-estree/src/ast-converter.ts#L38
  loc: true,
  range: true,
  comment: true,
  jsx: true,
  tokens: true,
  loggerFn: false,
  project: [],
};

function createParseError(error) {
  const { message, lineNumber, column } = error;

  /* c8 ignore next 3 */
  if (typeof lineNumber !== "number") {
    return error;
  }

  return createError(message, {
    loc: {
      start: { line: lineNumber, column: column + 1 },
    },
    cause: error,
  });
}

function parse(text, options) {
  const textToParse = replaceHashbang(text);
  const jsx = isTsxFile(options);

  let result;
  try {
    result = tryCombinations([
      // Try passing with our best guess first.
      () => parseWithNodeMaps(textToParse, { ...parseOptions, jsx }),
      // But if we get it wrong, try the opposite.
      () => parseWithNodeMaps(textToParse, { ...parseOptions, jsx: !jsx }),
    ]);
  } catch ({
    errors: [
      // Suppose our guess is correct, throw the first error
      error,
    ],
  }) {
    throw createParseError(error);
  }

  throwErrorForInvalidNodes(result, text);

  return postprocess(result.ast, { parser: "typescript", text });
}

export const typescript = createParser(parse);
