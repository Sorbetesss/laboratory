import {
  DOC_TYPE_IF_BREAK,
  DOC_TYPE_LINE,
  DOC_TYPE_STRING,
} from "../constants.js";
import { cleanDoc } from "../utils.js";
import getDocType from "./get-doc-type.js";
import traverseDoc from "./traverse-doc.js";

/**
 * @typedef {import("../builders.js").Doc} Doc
 */

const checked = process.env.NODE_ENV !== "production" && new WeakSet();
const noop = () => {};
const assertDoc =
  process.env.NODE_ENV === "production"
    ? noop
    : function (doc) {
        traverseDoc(doc, (doc) => {
          if (checked.has(doc)) {
            return false;
          }

          if (typeof doc !== "string") {
            checked.add(doc);
          }
        });
      };

const assertDocArray =
  process.env.NODE_ENV === "production"
    ? noop
    : function (docs, optional = false) {
        if (optional && !docs) {
          return;
        }

        if (!Array.isArray(docs)) {
          throw new TypeError("Unexpected doc array.");
        }

        for (const doc of docs) {
          assertDoc(doc);
        }
      };

const assertDocFill =
  process.env.NODE_ENV === "production"
    ? noop
    : /**
       * @param {Doc[]} parts
       */
      function (parts) {
        assertDocArray(parts);
        if (parts.length > 1 && cleanDoc(parts.at(-1)) === "") {
          // stripTrailingHardline can make hardline to empty string.
          // The trailing empty string is not a problem even if it's a line element.
          parts = parts.slice(0, -1);
        }
        for (const [i, doc] of parts.entries()) {
          if (i % 2 === 0) {
            continue;
          }
          if (!isValidSeparator(doc)) {
            const type = getDocType(doc);
            throw new Error(
              `Unexpected non-line-break doc at ${i}. Doc type is ${type}.`,
            );
          }
        }
      };

/**
 * @param {Doc} doc
 * @returns {boolean}
 */
function isValidSeparator(doc) {
  let hasLine = false;
  let hasString = false;
  traverseDoc(doc, (doc) => {
    switch (getDocType(doc)) {
      case DOC_TYPE_LINE:
        hasLine = true;
        return;
      case DOC_TYPE_STRING:
        hasString = true;
        return;
      case DOC_TYPE_IF_BREAK:
        traverseDoc(doc.breakContents, (doc) => {
          switch (getDocType(doc)) {
            case DOC_TYPE_LINE:
              hasLine = true;
            // We don't check hasString here
            // We sometimes need string in breakContents like `ifBreak([`{" "}`, line])`
          }
        });
        return false;
      default:
    }
  });
  return hasLine && !hasString;
}

export { assertDoc, assertDocArray, assertDocFill };
