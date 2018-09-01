"use strict";

const util = require("../common/util");
const { getOrderedListItemInfo, mapAst } = require("./utils");

// 0x0 ~ 0x10ffff
const isSingleCharRegex = /^([\u0000-\uffff]|[\ud800-\udbff][\udc00-\udfff])$/;

function preprocess(ast, options) {
  const text = options.originalText;
  ast = restoreUnescapedCharacter(text)()(ast);
  ast = mergeContinuousTexts()(ast);
  ast = transformInlineCode()(ast);
  ast = transformIndentedCodeblockAndMarkItsParentList(text)()(ast);
  ast = markAlignedList(text, options)()(ast);
  ast = splitText(options)()(ast);
  ast = transformImportExport()(ast);
  ast = mergeContinuousImportExport()(ast);
  return ast;
}

function transformImportExport() {
  return ast =>
    mapAst(ast, node => {
      if (node.type !== "import" && node.type !== "export") {
        return node;
      }

      return Object.assign({}, node, { type: "importExport" });
    });
}

function transformInlineCode() {
  return ast =>
    mapAst(ast, node => {
      if (node.type !== "inlineCode") {
        return node;
      }

      return Object.assign({}, node, {
        value: node.value.replace(/\s+/g, " ")
      });
    });
}

function restoreUnescapedCharacter(originalText) {
  return () => ast =>
    mapAst(ast, node => {
      return node.type !== "text"
        ? node
        : Object.assign({}, node, {
            value:
              node.value !== "*" &&
              node.value !== "_" && // handle these two cases in printer
              isSingleCharRegex.test(node.value) &&
              node.position.end.offset - node.position.start.offset !==
                node.value.length
                ? originalText.slice(
                    node.position.start.offset,
                    node.position.end.offset
                  )
                : node.value
          });
    });
}

function mergeContinuousImportExport() {
  return mergeChildren(
    (prevNode, node) =>
      prevNode.type === "importExport" && node.type === "importExport",
    (prevNode, node) => ({
      type: "importExport",
      value: prevNode.value + "\n\n" + node.value,
      position: {
        start: prevNode.position.start,
        end: node.position.end
      }
    })
  );
}

function mergeChildren(shouldMerge, mergeNode) {
  return ast =>
    mapAst(ast, node => {
      if (!node.children) {
        return node;
      }
      const children = node.children.reduce((current, child) => {
        const lastChild = current[current.length - 1];
        if (lastChild && shouldMerge(lastChild, child)) {
          current.splice(-1, 1, mergeNode(lastChild, child));
        } else {
          current.push(child);
        }
        return current;
      }, []);
      return Object.assign({}, node, { children });
    });
}

function mergeContinuousTexts() {
  return mergeChildren(
    (prevNode, node) => prevNode.type === "text" && node.type === "text",
    (prevNode, node) => ({
      type: "text",
      value: prevNode.value + node.value,
      position: {
        start: prevNode.position.start,
        end: node.position.end
      }
    })
  );
}

function splitText(options) {
  return () => ast =>
    mapAst(ast, (node, index, [parentNode]) => {
      if (node.type !== "text") {
        return node;
      }

      let value = node.value;

      if (parentNode.type === "paragraph") {
        if (index === 0) {
          value = value.trimLeft();
        }
        if (index === parentNode.children.length - 1) {
          value = value.trimRight();
        }
      }

      return {
        type: "sentence",
        position: node.position,
        children: util.splitText(value, options)
      };
    });
}

function transformIndentedCodeblockAndMarkItsParentList(originalText) {
  return () => ast =>
    mapAst(ast, (node, index, parentStack) => {
      if (node.type === "code") {
        // the first char may point to `\n`, e.g. `\n\t\tbar`, just ignore it
        const isIndented = /^\n?( {4,}|\t)/.test(
          originalText.slice(
            node.position.start.offset,
            node.position.end.offset
          )
        );

        node.isIndented = isIndented;

        if (isIndented) {
          for (let i = 0; i < parentStack.length; i++) {
            const parent = parentStack[i];

            // no need to check checked items
            if (parent.hasIndentedCodeblock) {
              break;
            }

            if (parent.type === "list") {
              parent.hasIndentedCodeblock = true;
            }
          }
        }
      }
      return node;
    });
}

function markAlignedList(originalText, options) {
  return () => ast =>
    mapAst(ast, (node, index, parentStack) => {
      if (node.type === "list" && node.children.length !== 0) {
        // if one of its parents is not aligned, it's not possible to be aligned in sub-lists
        for (let i = 0; i < parentStack.length; i++) {
          const parent = parentStack[i];
          if (parent.type === "list" && !parent.isAligned) {
            node.isAligned = false;
            return node;
          }
        }

        node.isAligned = isAligned(node);
      }

      return node;
    });

  function getListItemStart(listItem) {
    return listItem.children.length === 0
      ? -1
      : listItem.children[0].position.start.column - 1;
  }

  function isAligned(list) {
    if (!list.ordered) {
      /**
       * - 123
       * - 123
       */
      return true;
    }

    const [firstItem, secondItem] = list.children;

    const firstInfo = getOrderedListItemInfo(firstItem, originalText);

    if (firstInfo.leadingSpaces.length > 1) {
      /**
       * 1.   123
       *
       * 1.   123
       * 1. 123
       */
      return true;
    }

    const firstStart = getListItemStart(firstItem);

    if (firstStart === -1) {
      /**
       * 1.
       *
       * 1.
       * 1.
       */
      return false;
    }

    if (list.children.length === 1) {
      /**
       * aligned:
       *
       * 11. 123
       *
       * not aligned:
       *
       * 1. 123
       */
      return firstStart % options.tabWidth === 0;
    }

    const secondStart = getListItemStart(secondItem);

    if (firstStart !== secondStart) {
      /**
       * 11. 123
       * 1. 123
       *
       * 1. 123
       * 11. 123
       */
      return false;
    }

    if (firstStart % options.tabWidth === 0) {
      /**
       * 11. 123
       * 12. 123
       */
      return true;
    }

    /**
     * aligned:
     *
     * 11. 123
     * 1.  123
     *
     * not aligned:
     *
     * 1. 123
     * 2. 123
     */
    const secondInfo = getOrderedListItemInfo(secondItem, originalText);
    return secondInfo.leadingSpaces.length > 1;
  }
}

module.exports = preprocess;
