import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkWikiLink from "remark-wiki-link";
import { unified } from "unified";

import { locEnd, locStart } from "./loc.js";
import { BLOCKS_REGEX, esSyntax } from "./mdx.js";
import { hasPragma } from "./pragma.js";
import { remarkEntity } from "./unified-plugins/entity.js";
import { remarkEscape } from "./unified-plugins/escape.js";
import { remarkFrontMatter } from "./unified-plugins/front-matter.js";
import { remarkHtmlToJsx } from "./unified-plugins/html-to-jsx.js";
import { remarkLiquid } from "./unified-plugins/liquid.js";
import { remarkSingleDollarMath } from "./unified-plugins/math.js";
// import frontMatter from "./unified-plugins/front-matter.js";
// import htmlToJsx from "./unified-plugins/html-to-jsx.js";
// import liquid from "./unified-plugins/liquid.js";
// import wikiLink from "./unified-plugins/wiki-link.js";

/**
 * based on [MDAST](https://github.com/syntax-tree/mdast) with following modifications:
 *
 * 1. restore unescaped character (Text)
 * 2. merge continuous Texts
 * 3. replace whitespaces in InlineCode#value with one whitespace
 *    reference: http://spec.commonmark.org/0.25/#example-605
 * 4. split Text into Sentence
 *
 * interface Word { value: string }
 * interface Whitespace { value: string }
 * interface Sentence { children: Array<Word | Whitespace> }
 * interface InlineCode { children: Array<Sentence> }
 */
function createParse({ isMDX }) {
  return (text) => {
    const processor = unified()
      .use(remarkParse, {
        extensions: [{ disable: { null: ["characterEscape"] } }],
        commonmark: true,
        ...(isMDX && { blocks: [BLOCKS_REGEX] }),
      })
      .use(remarkEscape)
      .use(remarkGfm)
      .use(remarkFrontMatter, ["yaml", "toml"], text)
      .use(remarkSingleDollarMath)
      .use(remarkMath, { singleDollarTextMath: false })
      .use(isMDX ? esSyntax : noop)
      .use(remarkLiquid)
      .use(remarkWikiLink)
      .use(remarkEntity)
      .use(isMDX ? remarkHtmlToJsx : noop);
    return processor.run(processor.parse(text));
  };
}

function noop() {}

const baseParser = {
  astFormat: "mdast",
  hasPragma,
  locStart,
  locEnd,
};

export const markdown = { ...baseParser, parse: createParse({ isMDX: false }) };
export const mdx = { ...baseParser, parse: createParse({ isMDX: true }) };
export { markdown as remark };
