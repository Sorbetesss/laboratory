import { COMMENT_REGEX } from "../mdx.js";
import { INLINE_NODE_WRAPPER_TYPES } from "../utils.js";

/** @this {import('unified').Processor} */
function remarkHtmlToJsx() {
  /** @type {any} */
  const data = this.data();

  (data.fromMarkdownExtensions ??= []).push(fromMarkdown());
}

/** @returns {import('mdast-util-from-markdown').Extension} */
function fromMarkdown() {
  return {
    transforms: [
      function transform(node, parent) {
        if (
          node.type === "html" &&
          !(
            COMMENT_REGEX.test(node.value) ||
            INLINE_NODE_WRAPPER_TYPES.has(parent.type)
          )
        ) {
          return { ...node, type: "jsx" };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map((c) => transform(c, node)),
          };
        }
        return node;
      },
    ],
  };
}

export { remarkHtmlToJsx };
