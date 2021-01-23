"use strict";

const { printDanglingComments } = require("../../main/comments");
const {
  builders: { line, softline, hardline, group, indent, ifBreak, fill },
} = require("../../document");
const { getLast, hasNewline } = require("../../common/util");
const {
  shouldPrintComma,
  hasComment,
  CommentCheckFlags,
  isNextLineEmpty,
  isNumericLiteral,
} = require("../utils");
const { locStart } = require("../loc");

const { printOptionalToken, printTypeAnnotation } = require("./misc");

/** @typedef {import("../../document").Doc} Doc */

function printArray(path, options, print) {
  const n = path.getValue();
  /** @type{Doc[]} */
  const parts = [];

  const openBracket = n.type === "TupleExpression" ? "#[" : "[";
  const closeBracket = "]";
  if (n.elements.length === 0) {
    if (!hasComment(n, CommentCheckFlags.Dangling)) {
      parts.push(openBracket, closeBracket);
    } else {
      parts.push(
        group([
          openBracket,
          printDanglingComments(path, options),
          softline,
          closeBracket,
        ])
      );
    }
  } else {
    const lastElem = getLast(n.elements);
    const canHaveTrailingComma = !(lastElem && lastElem.type === "RestElement");

    // JavaScript allows you to have empty elements in an array which
    // changes its length based on the number of commas. The algorithm
    // is that if the last argument is null, we need to force insert
    // a comma to ensure JavaScript recognizes it.
    //   [,].length === 1
    //   [1,].length === 1
    //   [1,,].length === 2
    //
    // Note that getLast returns null if the array is empty, but
    // we already check for an empty array just above so we are safe
    const needsForcedTrailingComma = canHaveTrailingComma && lastElem === null;

    const shouldBreak =
      !options.__inJestEach &&
      n.elements.length > 1 &&
      n.elements.every((element, i, elements) => {
        const elementType = element && element.type;
        if (
          elementType !== "ArrayExpression" &&
          elementType !== "ObjectExpression"
        ) {
          return false;
        }

        const nextElement = elements[i + 1];
        if (nextElement && elementType !== nextElement.type) {
          return false;
        }

        const itemsKey =
          elementType === "ArrayExpression" ? "elements" : "properties";

        return element[itemsKey] && element[itemsKey].length > 1;
      });

    const shouldUseFill =
      n.elements.length > 1 &&
      n.elements.every(
        (element) =>
          element &&
          isNumericLiteral(element) &&
          !hasComment(
            element,
            CommentCheckFlags.Trailing | CommentCheckFlags.Line,
            (comment) =>
              !hasNewline(options.originalText, locStart(comment), {
                backwards: true,
              })
          )
      );

    parts.push(
      group(
        [
          openBracket,
          indent([
            softline,
            shouldUseFill
              ? printArrayItemsUsingFill(path, options, "elements", print)
              : printArrayItems(path, options, "elements", print),
          ]),
          needsForcedTrailingComma ? "," : "",
          ifBreak(
            canHaveTrailingComma &&
              !needsForcedTrailingComma &&
              shouldPrintComma(options)
              ? ","
              : ""
          ),
          printDanglingComments(path, options, /* sameIndent */ true),
          softline,
          closeBracket,
        ],
        { shouldBreak }
      )
    );
  }

  parts.push(
    printOptionalToken(path),
    printTypeAnnotation(path, options, print)
  );

  return parts;
}

function printArrayItems(path, options, printPath, print) {
  const printedElements = [];
  let separatorParts = [];

  path.each((childPath) => {
    printedElements.push(separatorParts, group(print(childPath)));

    separatorParts = [",", line];
    if (
      childPath.getValue() &&
      isNextLineEmpty(childPath.getValue(), options)
    ) {
      separatorParts.push(softline);
    }
  }, printPath);

  return printedElements;
}

function printArrayItemsUsingFill(path, options, printPath, print) {
  const parts = [];

  path.each((childPath, i, elements) => {
    const isLast = i === elements.length - 1;

    parts.push([print(childPath), isLast ? "" : ","]);

    if (!isLast) {
      parts.push(
        isNextLineEmpty(childPath.getValue(), options)
          ? [hardline, hardline]
          : hasComment(
              elements[i + 1],
              CommentCheckFlags.Leading | CommentCheckFlags.Line
            )
          ? hardline
          : line
      );
    }
  }, printPath);

  return fill(parts);
}

module.exports = { printArray, printArrayItems };
