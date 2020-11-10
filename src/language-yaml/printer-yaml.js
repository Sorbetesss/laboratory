"use strict";

const {
  builders: {
    breakParent,
    concat,
    fill,
    group,
    hardline,
    join,
    line,
    lineSuffix,
    literalline,
  },
} = require("../document");
const { replaceEndOfLineWith, isPreviousLineEmpty } = require("../common/util");
const { insertPragma, isPragma } = require("./pragma");
const { locStart } = require("./loc");
const {
  getFlowScalarLineContents,
  getLastDescendantNode,
  hasLeadingComments,
  hasMiddleComments,
  hasTrailingComment,
  hasEndComments,
  hasPrettierIgnore,
  isLastDescendantNode,
  isNode,
  isInlineNode,
  defineShortcut,
  mapNode,
} = require("./utils");
const {
  alignWithSpaces,
  printNextEmptyLine,
  shouldPrintEndComments,
} = require("./print/misc");
const {
  printFlowMapping,
  printFlowSequence,
} = require("./print/flow-mapping-sequence");
const printMappingItem = require("./print/mapping-item");
const printBlock = require("./print/block");

function preprocess(ast) {
  return mapNode(ast, defineShortcuts);
}

function defineShortcuts(node) {
  switch (node.type) {
    case "document":
      defineShortcut(node, "head", () => node.children[0]);
      defineShortcut(node, "body", () => node.children[1]);
      break;
    case "documentBody":
    case "sequenceItem":
    case "flowSequenceItem":
    case "mappingKey":
    case "mappingValue":
      defineShortcut(node, "content", () => node.children[0]);
      break;
    case "mappingItem":
    case "flowMappingItem":
      defineShortcut(node, "key", () => node.children[0]);
      defineShortcut(node, "value", () => node.children[1]);
      break;
  }
  return node;
}

function genericPrint(path, options, print) {
  const node = path.getValue();
  const parentNode = path.getParentNode();

  const tag = !node.tag ? "" : path.call(print, "tag");
  const anchor = !node.anchor ? "" : path.call(print, "anchor");

  const nextEmptyLine =
    isNode(node, [
      "mapping",
      "sequence",
      "comment",
      "directive",
      "mappingItem",
      "sequenceItem",
    ]) && !isLastDescendantNode(path)
      ? printNextEmptyLine(path, options.originalText)
      : "";

  return concat([
    node.type !== "mappingValue" && hasLeadingComments(node)
      ? concat([join(hardline, path.map(print, "leadingComments")), hardline])
      : "",
    tag,
    tag && anchor ? " " : "",
    anchor,
    tag || anchor
      ? isNode(node, ["sequence", "mapping"]) && !hasMiddleComments(node)
        ? hardline
        : " "
      : "",
    hasMiddleComments(node)
      ? concat([
          node.middleComments.length === 1 ? "" : hardline,
          join(hardline, path.map(print, "middleComments")),
          hardline,
        ])
      : "",
    hasPrettierIgnore(path)
      ? concat(
          replaceEndOfLineWith(
            options.originalText
              .slice(node.position.start.offset, node.position.end.offset)
              .trimEnd(),
            literalline
          )
        )
      : group(printNode(node, parentNode, path, options, print)),
    hasTrailingComment(node) && !isNode(node, ["document", "documentHead"])
      ? lineSuffix(
          concat([
            node.type === "mappingValue" && !node.content ? "" : " ",
            parentNode.type === "mappingKey" &&
            path.getParentNode(2).type === "mapping" &&
            isInlineNode(node)
              ? ""
              : breakParent,
            path.call(print, "trailingComment"),
          ])
        )
      : "",
    shouldPrintEndComments(node)
      ? alignWithSpaces(
          node.type === "sequenceItem" ? 2 : 0,
          concat([
            hardline,
            join(
              hardline,
              path.map(
                (path) =>
                  concat([
                    isPreviousLineEmpty(
                      options.originalText,
                      path.getValue(),
                      locStart
                    )
                      ? hardline
                      : "",
                    print(path),
                  ]),
                "endComments"
              )
            ),
          ])
        )
      : "",
    nextEmptyLine,
  ]);
}

function printNode(node, parentNode, path, options, print) {
  switch (node.type) {
    case "root":
      return concat([
        join(
          hardline,
          path.map((childPath, index) => {
            const document = node.children[index];
            const nextDocument = node.children[index + 1];
            return concat([
              print(childPath),
              shouldPrintDocumentEndMarker(document, nextDocument)
                ? concat([
                    hardline,
                    "...",
                    hasTrailingComment(document)
                      ? concat([" ", path.call(print, "trailingComment")])
                      : "",
                  ])
                : !nextDocument || hasTrailingComment(nextDocument.head)
                ? ""
                : concat([hardline, "---"]),
            ]);
          }, "children")
        ),
        node.children.length === 0 ||
        ((lastDescendantNode) =>
          isNode(lastDescendantNode, ["blockLiteral", "blockFolded"]) &&
          lastDescendantNode.chomping === "keep")(getLastDescendantNode(node))
          ? ""
          : hardline,
      ]);
    case "document": {
      const nextDocument = parentNode.children[path.getName() + 1];
      return join(
        hardline,
        [
          shouldPrintDocumentHeadEndMarker(
            node,
            nextDocument,
            parentNode,
            options
          ) === "head"
            ? join(
                hardline,
                [
                  node.head.children.length === 0 &&
                  node.head.endComments.length === 0
                    ? ""
                    : path.call(print, "head"),
                  concat([
                    "---",
                    hasTrailingComment(node.head)
                      ? concat([
                          " ",
                          path.call(print, "head", "trailingComment"),
                        ])
                      : "",
                  ]),
                ].filter(Boolean)
              )
            : "",
          shouldPrintDocumentBody(node) ? path.call(print, "body") : "",
        ].filter(Boolean)
      );
    }
    case "documentHead":
      return join(hardline, [
        ...path.map(print, "children"),
        ...path.map(print, "endComments"),
      ]);
    case "documentBody": {
      const children = join(hardline, path.map(print, "children")).parts;
      const endComments = join(hardline, path.map(print, "endComments")).parts;
      const separator =
        children.length === 0 || endComments.length === 0
          ? ""
          : ((lastDescendantNode) =>
              isNode(lastDescendantNode, ["blockFolded", "blockLiteral"])
                ? lastDescendantNode.chomping === "keep"
                  ? // there's already a newline printed at the end of blockValue (chomping=keep, lastDescendant=true)
                    ""
                  : // an extra newline for better readability
                    concat([hardline, hardline])
                : hardline)(getLastDescendantNode(node));
      return concat([].concat(children, separator, endComments));
    }
    case "directive":
      return concat(["%", join(" ", [node.name].concat(node.parameters))]);
    case "comment":
      return concat(["#", node.value]);
    case "alias":
      return concat(["*", node.value]);
    case "tag":
      return options.originalText.slice(
        node.position.start.offset,
        node.position.end.offset
      );
    case "anchor":
      return concat(["&", node.value]);
    case "plain":
      return printFlowScalarContent(
        node.type,
        options.originalText.slice(
          node.position.start.offset,
          node.position.end.offset
        ),
        options
      );
    case "quoteDouble":
    case "quoteSingle": {
      const singleQuote = "'";
      const doubleQuote = '"';

      const raw = options.originalText.slice(
        node.position.start.offset + 1,
        node.position.end.offset - 1
      );

      if (
        (node.type === "quoteSingle" && raw.includes("\\")) ||
        (node.type === "quoteDouble" && /\\[^"]/.test(raw))
      ) {
        // only quoteDouble can use escape chars
        // and quoteSingle do not need to escape backslashes
        const originalQuote =
          node.type === "quoteDouble" ? doubleQuote : singleQuote;
        return concat([
          originalQuote,
          printFlowScalarContent(node.type, raw, options),
          originalQuote,
        ]);
      } else if (raw.includes(doubleQuote)) {
        return concat([
          singleQuote,
          printFlowScalarContent(
            node.type,
            node.type === "quoteDouble"
              ? raw
                  // double quote needs to be escaped by backslash in quoteDouble
                  .replace(/\\"/g, doubleQuote)
                  .replace(/'/g, singleQuote.repeat(2))
              : raw,
            options
          ),
          singleQuote,
        ]);
      }

      if (raw.includes(singleQuote)) {
        return concat([
          doubleQuote,
          printFlowScalarContent(
            node.type,
            node.type === "quoteSingle"
              ? // single quote needs to be escaped by 2 single quotes in quoteSingle
                raw.replace(/''/g, singleQuote)
              : raw,
            options
          ),
          doubleQuote,
        ]);
      }

      const quote = options.singleQuote ? singleQuote : doubleQuote;
      return concat([
        quote,
        printFlowScalarContent(node.type, raw, options),
        quote,
      ]);
    }
    case "blockFolded":
    case "blockLiteral": {
      return printBlock(path, print, options);
    }
    case "sequence":
      return join(hardline, path.map(print, "children"));
    case "sequenceItem":
      return concat([
        "- ",
        alignWithSpaces(2, !node.content ? "" : path.call(print, "content")),
      ]);
    case "mappingKey":
      return !node.content ? "" : path.call(print, "content");
    case "mappingValue":
      return !node.content ? "" : path.call(print, "content");
    case "mapping":
      return join(hardline, path.map(print, "children"));
    case "mappingItem":
    case "flowMappingItem": {
      return printMappingItem(node, parentNode, path, print, options);
    }
    case "flowMapping":
      return printFlowMapping(path, print, options);
    case "flowSequence":
      return printFlowSequence(path, print, options);
    case "flowSequenceItem":
      return path.call(print, "content");
    // istanbul ignore next
    default:
      throw new Error(`Unexpected node type ${node.type}`);
  }
}

function shouldPrintDocumentBody(document) {
  return document.body.children.length !== 0 || hasEndComments(document.body);
}

function shouldPrintDocumentEndMarker(document, nextDocument) {
  return (
    /**
     *... # trailingComment
     */
    hasTrailingComment(document) ||
    (nextDocument &&
      /**
       * ...
       * %DIRECTIVE
       * ---
       */
      (nextDocument.head.children.length !== 0 ||
        /**
         * ...
         * # endComment
         * ---
         */
        hasEndComments(nextDocument.head)))
  );
}

function shouldPrintDocumentHeadEndMarker(
  document,
  nextDocument,
  root,
  options
) {
  if (
    /**
     * ---
     * preserve the first document head end marker
     */
    (root.children[0] === document &&
      /---(\s|$)/.test(
        options.originalText.slice(locStart(document), locStart(document) + 4)
      )) ||
    /**
     * %DIRECTIVE
     * ---
     */
    document.head.children.length !== 0 ||
    /**
     * # end comment
     * ---
     */
    hasEndComments(document.head) ||
    /**
     * --- # trailing comment
     */
    hasTrailingComment(document.head)
  ) {
    return "head";
  }

  if (shouldPrintDocumentEndMarker(document, nextDocument)) {
    return false;
  }

  return nextDocument ? "root" : false;
}

function printFlowScalarContent(nodeType, content, options) {
  const lineContents = getFlowScalarLineContents(nodeType, content, options);
  return join(
    hardline,
    lineContents.map((lineContentWords) =>
      fill(join(line, lineContentWords).parts)
    )
  );
}

function clean(node, newNode /*, parent */) {
  if (isNode(newNode)) {
    delete newNode.position;
    switch (newNode.type) {
      case "comment":
        // insert pragma
        if (isPragma(newNode.value)) {
          return null;
        }
        break;
      case "quoteDouble":
      case "quoteSingle":
        newNode.type = "quote";
        break;
    }
  }
}

module.exports = {
  preprocess,
  print: genericPrint,
  massageAstNode: clean,
  insertPragma,
};
