"use strict";

const clean = require("./clean");
const {
  builders,
  utils: { stripTrailingHardline, mapDoc }
} = require("../doc");
const {
  breakParent,
  group,
  hardline,
  indent,
  join,
  line,
  literalline,
  markAsRoot,
  softline
} = builders;
const {
  dedentString,
  forceBreakChildren,
  forceBreakContent,
  forceNextEmptyLine,
  getCommentData,
  getLastDescendant,
  hasPrettierIgnore,
  identity,
  inferScriptParser,
  isScriptLikeTag,
  normalizeParts,
  preferHardlineAsLeadingSpaces,
  replaceDocNewlines,
  replaceNewlines
} = require("./utils");
const preprocess = require("./preprocess");
const assert = require("assert");
const { insertPragma } = require("./pragma");
const { printVueFor, printVueSlotScope } = require("./syntax-vue");

function concat(parts) {
  const newParts = normalizeParts(parts);
  return newParts.length === 0
    ? ""
    : newParts.length === 1
      ? newParts[0]
      : builders.concat(newParts);
}

function fill(parts) {
  const newParts = [];

  let hasSeparator = true;
  for (const part of normalizeParts(parts)) {
    switch (part) {
      case line:
      case hardline:
      case literalline:
      case softline:
        newParts.push(part);
        hasSeparator = true;
        break;
      default:
        if (!hasSeparator) {
          // `fill` needs a separator between each two parts
          newParts.push("");
        }
        newParts.push(part);
        hasSeparator = false;
        break;
    }
  }

  return builders.fill(newParts);
}

function embed(path, print, textToDoc, options) {
  const node = path.getValue();
  switch (node.type) {
    case "text": {
      if (isScriptLikeTag(node.parent)) {
        const parser = inferScriptParser(node.parent);
        if (parser) {
          const data =
            parser === "markdown"
              ? dedentString(node.data.replace(/^[^\S\n]*?\n/, ""))
              : node.data;
          return builders.concat([
            concat([
              breakParent,
              printOpeningTagPrefix(node),
              markAsRoot(stripTrailingHardline(textToDoc(data, { parser }))),
              printClosingTagSuffix(node)
            ])
          ]);
        }
      } else if (options.parser !== "html") {
        const interpolationTextParts = getInterpolationTextDataParts(
          node,
          textToDoc,
          options
        );
        if (interpolationTextParts) {
          return fill(
            [].concat(
              printOpeningTagPrefix(node),
              interpolationTextParts,
              printClosingTagSuffix(node)
            )
          );
        }
      }
      break;
    }
    case "attribute": {
      const embeddedAttributeValueDoc = printEmbeddedAttributeValue(
        node,
        (code, opts) =>
          // prefer single quote to avoid unnecessary escape
          textToDoc(code, Object.assign({ singleQuote: true }, opts)),
        options
      );
      if (embeddedAttributeValueDoc) {
        return concat([
          node.key,
          '="',
          mapDoc(
            embeddedAttributeValueDoc,
            doc => (typeof doc === "string" ? doc.replace(/"/g, "&quot;") : doc)
          ),
          '"'
        ]);
      }
      break;
    }
    case "yaml":
      return markAsRoot(
        concat([
          "---",
          hardline,
          node.value.trim().length === 0
            ? ""
            : replaceDocNewlines(
                textToDoc(node.value, { parser: "yaml" }),
                literalline
              ),
          "---"
        ])
      );
  }
}

function genericPrint(path, options, print) {
  const node = path.getValue();
  switch (node.type) {
    case "root":
      return concat([group(printChildren(path, options, print)), hardline]);
    case "tag":
    case "ieConditionalComment":
      return concat([
        group(
          concat([
            printOpeningTag(path, options, print),
            node.children.length === 0
              ? node.hasDanglingSpaces && node.isDanglingSpaceSensitive
                ? line
                : ""
              : concat([
                  forceBreakContent(node) ? breakParent : "",
                  (isScriptLikeTag(node) &&
                  node.parent.type === "root" &&
                  options.parser === "vue"
                    ? identity
                    : indent)(
                    concat([
                      node.firstChild.type === "text" &&
                      node.firstChild.isWhiteSpaceSensitive &&
                      node.firstChild.isIndentationSensitive
                        ? literalline
                        : node.firstChild.hasLeadingSpaces &&
                          node.firstChild.isLeadingSpaceSensitive
                          ? line
                          : softline,
                      printChildren(path, options, print)
                    ])
                  ),
                  (node.next
                  ? needsToBorrowPrevClosingTagEndMarker(node.next)
                  : needsToBorrowLastChildClosingTagEndMarker(node.parent))
                    ? ""
                    : node.lastChild.hasTrailingSpaces &&
                      node.lastChild.isTrailingSpaceSensitive
                      ? line
                      : softline
                ])
          ])
        ),
        printClosingTag(node)
      ]);
    case "text":
      return fill(
        [].concat(
          printOpeningTagPrefix(node),
          getTextDataParts(node),
          printClosingTagSuffix(node)
        )
      );
    case "comment":
    case "directive": {
      const data = getCommentData(node);
      return concat([
        group(
          concat([
            printOpeningTagStart(node),
            data.trim().length === 0
              ? ""
              : concat([
                  indent(
                    concat([
                      node.prev &&
                      needsToBorrowNextOpeningTagStartMarker(node.prev)
                        ? breakParent
                        : "",
                      node.type === "directive" ? " " : line,
                      concat(replaceNewlines(data, hardline))
                    ])
                  ),
                  node.type === "directive"
                    ? ""
                    : (node.next
                      ? needsToBorrowPrevClosingTagEndMarker(node.next)
                      : needsToBorrowLastChildClosingTagEndMarker(node.parent))
                      ? " "
                      : line
                ])
          ])
        ),
        printClosingTagEnd(node)
      ]);
    }
    case "attribute":
      return concat([
        node.key,
        node.value === null
          ? ""
          : concat([
              '="',
              concat(
                replaceNewlines(node.value.replace(/"/g, "&quot;"), literalline)
              ),
              '"'
            ])
      ]);
    case "yaml":
    case "toml":
      return node.raw;
    default:
      throw new Error(`Unexpected node type ${node.type}`);
  }
}

function printChildren(path, options, print) {
  const node = path.getValue();

  if (forceBreakChildren(node)) {
    return concat([
      breakParent,
      concat(
        path.map(childPath => {
          const childNode = childPath.getValue();
          const prevBetweenLine = !childNode.prev
            ? ""
            : printBetweenLine(childNode.prev, childNode);
          return concat([
            !prevBetweenLine
              ? ""
              : concat([
                  prevBetweenLine,
                  forceNextEmptyLine(childNode.prev) ||
                  childNode.prev.endLocation.line + 1 <
                    childNode.startLocation.line
                    ? hardline
                    : ""
                ]),
            printChild(childPath)
          ]);
        }, "children")
      )
    ]);
  }

  const parts = [];

  path.map((childPath, childIndex) => {
    const childNode = childPath.getValue();

    if (childIndex !== 0) {
      const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
      if (prevBetweenLine) {
        if (
          forceNextEmptyLine(childNode.prev) ||
          childNode.prev.endLocation.line + 1 < childNode.startLocation.line
        ) {
          parts.push(hardline, hardline);
        } else {
          parts.push(prevBetweenLine);
        }
      }
    }

    const childDoc = printChild(childPath);
    Array.prototype.push.apply(
      parts,
      childNode.type === "text" && childDoc.parts ? childDoc.parts : [childDoc]
    );
  }, "children");

  return fill(parts);

  function printChild(childPath) {
    if (!hasPrettierIgnore(childPath)) {
      return print(childPath);
    }
    const child = childPath.getValue();
    return concat([
      printOpeningTagPrefix(child),
      options.originalText.slice(
        options.locStart(child) +
          (child.prev && needsToBorrowNextOpeningTagStartMarker(child.prev)
            ? printOpeningTagStartMarker(child).length
            : 0),
        options.locEnd(child) -
          (child.next && needsToBorrowPrevClosingTagEndMarker(child.next)
            ? printClosingTagEndMarker(child).length
            : 0),
        printClosingTagSuffix(child)
      )
    ]);
  }

  function printBetweenLine(prevNode, nextNode) {
    return (needsToBorrowNextOpeningTagStartMarker(prevNode) &&
      /**
       *     123<a
       *          ~
       *       ><b>
       */
      (nextNode.firstChild ||
        /**
         *     123<!--
         *            ~
         *     -->
         */
        nextNode.isSelfClosing ||
        /**
         *     123<span
         *             ~
         *       attr
         */
        (nextNode.type === "tag" && nextNode.attributes.length !== 0))) ||
      /**
       *     <img
       *       src="long"
       *                 ~
       *     />123
       */
      (prevNode.type === "tag" &&
        prevNode.isSelfClosing &&
        needsToBorrowPrevClosingTagEndMarker(nextNode))
      ? ""
      : !nextNode.isLeadingSpaceSensitive ||
        preferHardlineAsLeadingSpaces(nextNode) ||
        /**
         *       Want to write us a letter? Use our<a
         *         ><b><a>mailing address</a></b></a
         *                                          ~
         *       >.
         */
        (needsToBorrowPrevClosingTagEndMarker(nextNode) &&
          prevNode.lastChild &&
          needsToBorrowParentClosingTagStartMarker(prevNode.lastChild) &&
          prevNode.lastChild.lastChild &&
          needsToBorrowParentClosingTagStartMarker(
            prevNode.lastChild.lastChild
          ))
        ? hardline
        : nextNode.hasLeadingSpaces
          ? line
          : softline;
  }
}

function printOpeningTag(path, options, print) {
  const node = path.getValue();
  const forceNotToBreakAttrContent =
    node.type === "tag" &&
    node.name === "script" &&
    node.attributes.length === 1 &&
    node.attributes[0].key === "src" &&
    node.children.length === 0;
  return concat([
    printOpeningTagStart(node),
    !node.attributes || node.attributes.length === 0
      ? node.isSelfClosing
        ? /**
           *     <br />
           *        ^
           */
          " "
        : ""
      : group(
          concat([
            node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
              ? /**
                 *     123<a
                 *       attr
                 *     >
                 */
                breakParent
              : "",
            indent(
              concat([
                forceNotToBreakAttrContent ? " " : line,
                join(line, path.map(print, "attributes"))
              ])
            ),
            /**
             *     123<a
             *       attr
             *           ~
             *       >456
             */
            (node.firstChild &&
              needsToBorrowParentOpeningTagEndMarker(node.firstChild)) ||
            /**
             *     <span
             *       >123<meta
             *                ~
             *     /></span>
             */
            (node.isSelfClosing &&
              needsToBorrowLastChildClosingTagEndMarker(node.parent))
              ? ""
              : node.isSelfClosing
                ? forceNotToBreakAttrContent
                  ? " "
                  : line
                : forceNotToBreakAttrContent
                  ? ""
                  : softline
          ])
        ),
    node.isSelfClosing ? "" : printOpeningTagEnd(node)
  ]);
}

function printOpeningTagStart(node) {
  return node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
    ? ""
    : concat([printOpeningTagPrefix(node), printOpeningTagStartMarker(node)]);
}

function printOpeningTagEnd(node) {
  return node.firstChild &&
    needsToBorrowParentOpeningTagEndMarker(node.firstChild)
    ? ""
    : printOpeningTagEndMarker(node);
}

function printClosingTag(node) {
  return concat([
    node.isSelfClosing ? "" : printClosingTagStart(node),
    printClosingTagEnd(node)
  ]);
}

function printClosingTagStart(node) {
  return node.lastChild &&
    needsToBorrowParentClosingTagStartMarker(node.lastChild)
    ? ""
    : concat([printClosingTagPrefix(node), printClosingTagStartMarker(node)]);
}

function printClosingTagEnd(node) {
  return (node.next
  ? needsToBorrowPrevClosingTagEndMarker(node.next)
  : needsToBorrowLastChildClosingTagEndMarker(node.parent))
    ? ""
    : concat([printClosingTagEndMarker(node), printClosingTagSuffix(node)]);
}

function needsToBorrowNextOpeningTagStartMarker(node) {
  /**
   *     123<p
   *        ^^
   *     >
   */
  return (
    node.next &&
    node.type === "text" &&
    node.isTrailingSpaceSensitive &&
    !node.hasTrailingSpaces
  );
}

function needsToBorrowParentOpeningTagEndMarker(node) {
  /**
   *     <p
   *       >123
   *       ^
   *
   *     <p
   *       ><a
   *       ^
   */
  return !node.prev && node.isLeadingSpaceSensitive && !node.hasLeadingSpaces;
}

function needsToBorrowPrevClosingTagEndMarker(node) {
  /**
   *     <p></p
   *     >123
   *     ^
   *
   *     <p></p
   *     ><a
   *     ^
   */
  return node.prev && node.isLeadingSpaceSensitive && !node.hasLeadingSpaces;
}

function needsToBorrowLastChildClosingTagEndMarker(node) {
  /**
   *     <p
   *       ><a></a
   *       ></p
   *       ^
   *     >
   */
  return (
    node.lastChild &&
    node.lastChild.isTrailingSpaceSensitive &&
    !node.lastChild.hasTrailingSpaces &&
    getLastDescendant(node.lastChild).type !== "text"
  );
}

function needsToBorrowParentClosingTagStartMarker(node) {
  /**
   *     <p>
   *       123</p
   *          ^^^
   *     >
   *
   *         123</b
   *       ></a
   *        ^^^
   *     >
   */
  return (
    !node.next &&
    !node.hasTrailingSpaces &&
    node.isTrailingSpaceSensitive &&
    getLastDescendant(node).type === "text"
  );
}

function printOpeningTagPrefix(node) {
  return needsToBorrowParentOpeningTagEndMarker(node)
    ? printOpeningTagEndMarker(node.parent)
    : needsToBorrowPrevClosingTagEndMarker(node)
      ? printClosingTagEndMarker(node.prev)
      : "";
}

function printClosingTagPrefix(node) {
  return needsToBorrowLastChildClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.lastChild)
    : "";
}

function printClosingTagSuffix(node) {
  return needsToBorrowParentClosingTagStartMarker(node)
    ? printClosingTagStartMarker(node.parent)
    : needsToBorrowNextOpeningTagStartMarker(node)
      ? printOpeningTagStartMarker(node.next)
      : "";
}

function printOpeningTagStartMarker(node) {
  switch (node.type) {
    case "comment":
      return "<!--";
    case "ieConditionalComment":
      return `<!--[if ${node.condition}`;
    default:
      return `<${node.name}`;
  }
}

function printOpeningTagEndMarker(node) {
  assert(!node.isSelfClosing);
  switch (node.type) {
    case "ieConditionalComment":
      return "]>";
    default:
      return `>`;
  }
}

function printClosingTagStartMarker(node) {
  assert(!node.isSelfClosing);
  switch (node.type) {
    case "ieConditionalComment":
      return "<!";
    default:
      return `</${node.name}`;
  }
}

function printClosingTagEndMarker(node) {
  switch (node.type) {
    case "comment":
      return "-->";
    case "ieConditionalComment":
      return `[endif]-->`;
    case "tag":
      if (node.isSelfClosing) {
        return "/>";
      }
    // fall through
    default:
      return ">";
  }
}

function getTextDataParts(node, data = node.data) {
  return node.isWhiteSpaceSensitive
    ? node.isIndentationSensitive
      ? replaceNewlines(data.replace(/^\s*?\n|\n\s*?$/g, ""), literalline)
      : replaceNewlines(
          dedentString(data.replace(/^\s*?\n|\n\s*?$/g, "")),
          hardline
        )
    : join(line, data.split(/\s+/)).parts;
}

function getInterpolationTextDataParts(node, textToDoc, options) {
  const interpolationRegex = /\{\{([\s\S]+?)\}\}/g;
  if (!interpolationRegex.test(node.data)) {
    return null;
  }

  const componentParts = [];
  const TYPE_INTERPOLATION_FAILED = "interpolationFailed";
  const TYPE_INTERPOLATION_IDENTIFIER = "interpolationIdentifier";

  const identifierRegex = /^\w+$/;

  const components = node.data.split(interpolationRegex);
  for (let i = 0; i < components.length; i++) {
    const component = components[i];

    if (i % 2 === 0) {
      const text =
        (i === 0 ? "" : "}}") +
        component +
        (i === components.length - 1 ? "" : "{{");

      componentParts.push(text);
      continue;
    }

    const interpolation = component;

    const trimmedInterpolation = interpolation.trim();
    if (identifierRegex.test(trimmedInterpolation)) {
      componentParts.push({
        type: TYPE_INTERPOLATION_IDENTIFIER,
        data: trimmedInterpolation
      });
      continue;
    }

    try {
      const interpolationDoc = textToDoc(interpolation, {
        parser:
          options.parser === "angular"
            ? "__ng_interpolation"
            : "__js_expression"
      });
      componentParts.push(interpolationDoc);
    } catch (e) {
      componentParts.push({
        type: TYPE_INTERPOLATION_FAILED,
        data: interpolation
      });
    }
  }

  const parts = [];

  for (let i = 0; i < componentParts.length; i++) {
    const componentPart = componentParts[i];
    if (i % 2 === 0) {
      Array.prototype.push.apply(parts, getTextDataParts(node, componentPart));
      continue;
    }

    switch (componentPart.type) {
      case TYPE_INTERPOLATION_FAILED: {
        const trailingNewlineRegex = /\n[^\S\n]*?$/;
        // replace the trailing literalline with hardline for better readability
        Array.prototype.push.apply(
          parts,
          [].concat(
            replaceNewlines(
              componentPart.data.replace(trailingNewlineRegex, ""),
              literalline
            ),
            trailingNewlineRegex.test(componentPart.data) ? hardline : []
          )
        );
        break;
      }
      case TYPE_INTERPOLATION_IDENTIFIER:
        parts.push(componentPart.data);
        break;
      default:
        parts.push(
          group(concat([indent(concat([softline, componentPart])), softline]))
        );
        break;
    }
  }

  return parts;
}

function printEmbeddedAttributeValue(node, textToDoc, options) {
  const isKeyMatched = patterns =>
    new RegExp(patterns.join("|")).test(node.key);
  const getValue = () =>
    node.value.replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  if (options.parser === "vue") {
    if (node.key === "v-for") {
      return printVueFor(getValue(), textToDoc);
    }

    if (node.key === "slot-scope") {
      return printVueSlotScope(getValue(), textToDoc);
    }

    /**
     *     @click="jsStatement"
     *     @click="jsExpression"
     *     v-on:click="jsStatement"
     *     v-on:click="jsExpression"
     */
    const vueEventBindingPatterns = ["^@", "^v-on:"];
    /**
     *     :class="jsExpression"
     *     v-bind:id="jsExpression"
     *     v-if="jsExpression"
     */
    const vueExpressionBindingPatterns = ["^:", "^v-"];

    if (isKeyMatched(vueEventBindingPatterns)) {
      // copied from https://github.com/vuejs/vue/blob/v2.5.17/src/compiler/codegen/events.js#L3-L4
      const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/;
      const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/;

      const value = getValue();
      const doc =
        simplePathRE.test(value) || fnExpRE.test(value)
          ? textToDoc(value, { parser: "__js_expression" })
          : stripTrailingHardline(textToDoc(value, { parser: "babylon" }));
      return group(concat([indent(concat([softline, doc])), softline]));
    }

    if (isKeyMatched(vueExpressionBindingPatterns)) {
      return textToDoc(getValue(), { parser: "__js_expression" });
    }
  }

  if (options.parser === "angular") {
    /**
     *     *directive="angularDirective"
     */
    const ngDirectiveBindingPatterns = ["^\\*"];
    /**
     *     (click)="angularStatement"
     *     on-click="angularStatement"
     */
    const ngStatementBindingPatterns = ["^\\(.+\\)$", "^on-"];
    /**
     *     [target]="angularExpression"
     *     bind-target="angularExpression"
     *     [(target)]="angularExpression"
     *     bindon-target="angularExpression"
     */
    const ngExpressionBindingPatterns = ["^\\[.+\\]$", "^bind(on)?-"];

    if (isKeyMatched(ngStatementBindingPatterns)) {
      return textToDoc(getValue(), { parser: "__ng_action" });
    }

    if (isKeyMatched(ngExpressionBindingPatterns)) {
      return textToDoc(getValue(), { parser: "__ng_binding" });
    }

    if (isKeyMatched(ngDirectiveBindingPatterns)) {
      return group(
        concat([
          indent(
            concat([
              softline,
              textToDoc(getValue(), { parser: "__ng_directive" })
            ])
          ),
          softline
        ])
      );
    }
  }

  return null;
}

module.exports = {
  preprocess,
  print: genericPrint,
  insertPragma,
  massageAstNode: clean,
  embed
};
