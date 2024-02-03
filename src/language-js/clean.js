import { isArrayOrTupleExpression } from "./utils/index.js";
import isBlockComment from "./utils/is-block-comment.js";

const ignoredProperties = new Set([
  "range",
  "raw",
  "comments",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "extra",
  "start",
  "end",
  "loc",
  "flags",
  "errors",
  "tokens",
]);

const removeTemplateElementsValue = (node) => {
  for (const templateElement of node.quasis) {
    delete templateElement.value;
  }
};

function clean(original, clone, parent) {
  if (original.type === "Program") {
    delete clone.sourceType;
  }

  if (
    (original.type === "BigIntLiteral" ||
      original.type === "BigIntLiteralTypeAnnotation") &&
    clone.value
  ) {
    clone.value = clone.value.toLowerCase();
  }
  if (
    (original.type === "BigIntLiteral" || original.type === "Literal") &&
    clone.bigint
  ) {
    clone.bigint = clone.bigint.toLowerCase();
  }

  if (original.type === "DecimalLiteral") {
    clone.value = Number(clone.value);
  }
  if (original.type === "Literal" && clone.decimal) {
    clone.decimal = Number(clone.decimal);
  }

  // We remove extra `;` and add them when needed
  if (original.type === "EmptyStatement") {
    return null;
  }

  // We move text around, including whitespaces and add {" "}
  if (original.type === "JSXText") {
    return null;
  }
  if (
    original.type === "JSXExpressionContainer" &&
    (original.expression.type === "Literal" ||
      original.expression.type === "StringLiteral") &&
    original.expression.value === " "
  ) {
    return null;
  }

  // We change {'key': value} into {key: value}.
  // And {key: value} into {'key': value}.
  // Also for (some) number keys.
  if (
    (original.type === "Property" ||
      original.type === "ObjectProperty" ||
      original.type === "MethodDefinition" ||
      original.type === "ClassProperty" ||
      original.type === "ClassMethod" ||
      original.type === "PropertyDefinition" ||
      original.type === "TSDeclareMethod" ||
      original.type === "TSPropertySignature" ||
      original.type === "ObjectTypeProperty") &&
    typeof original.key === "object" &&
    original.key &&
    (original.key.type === "Literal" ||
      original.key.type === "NumericLiteral" ||
      original.key.type === "StringLiteral" ||
      original.key.type === "Identifier")
  ) {
    delete clone.key;
  }

  // Remove raw and cooked values from TemplateElement when it's CSS
  // styled-jsx
  if (
    original.type === "JSXElement" &&
    original.openingElement.name.name === "style" &&
    original.openingElement.attributes.some(
      (attr) => attr.type === "JSXAttribute" && attr.name.name === "jsx",
    )
  ) {
    for (const { type, expression } of clone.children) {
      if (
        type === "JSXExpressionContainer" &&
        expression.type === "TemplateLiteral"
      ) {
        removeTemplateElementsValue(expression);
      }
    }
  }

  // CSS template literals in css prop
  if (
    original.type === "JSXAttribute" &&
    original.name.name === "css" &&
    original.value.type === "JSXExpressionContainer" &&
    original.value.expression.type === "TemplateLiteral"
  ) {
    removeTemplateElementsValue(clone.value.expression);
  }

  // We change quotes
  if (
    original.type === "JSXAttribute" &&
    original.value?.type === "Literal" &&
    /["']|&quot;|&apos;/.test(original.value.value)
  ) {
    clone.value.value = clone.value.value.replaceAll(
      /["']|&quot;|&apos;/g,
      '"',
    );
  }

  // Angular Components: Inline HTML template and Inline CSS styles
  const expression = original.expression || original.callee;
  if (
    original.type === "Decorator" &&
    expression.type === "CallExpression" &&
    expression.callee.name === "Component" &&
    expression.arguments.length === 1
  ) {
    const astProps = original.expression.arguments[0].properties;
    for (const [
      index,
      prop,
    ] of clone.expression.arguments[0].properties.entries()) {
      switch (astProps[index].key.name) {
        case "styles":
          if (isArrayOrTupleExpression(prop.value)) {
            removeTemplateElementsValue(prop.value.elements[0]);
          }
          break;
        case "template":
          if (prop.value.type === "TemplateLiteral") {
            removeTemplateElementsValue(prop.value);
          }
          break;
      }
    }
  }

  // styled-components, graphql, markdown
  if (
    original.type === "TaggedTemplateExpression" &&
    (original.tag.type === "MemberExpression" ||
      (original.tag.type === "Identifier" &&
        (original.tag.name === "gql" ||
          original.tag.name === "graphql" ||
          original.tag.name === "css" ||
          original.tag.name === "md" ||
          original.tag.name === "markdown" ||
          original.tag.name === "html")) ||
      original.tag.type === "CallExpression")
  ) {
    removeTemplateElementsValue(clone.quasi);
  }
  if (original.type === "TemplateLiteral") {
    // This checks for a leading comment that is exactly `/* GraphQL */`
    // In order to be in line with other implementations of this comment tag
    // we will not trim the comment value and we will expect exactly one space on
    // either side of the GraphQL string
    // Also see ./embed.js
    const hasLanguageComment = original.leadingComments?.some(
      (comment) =>
        isBlockComment(comment) &&
        ["GraphQL", "HTML"].some(
          (languageName) => comment.value === ` ${languageName} `,
        ),
    );
    if (
      hasLanguageComment ||
      (parent.type === "CallExpression" && parent.callee.name === "graphql") ||
      // TODO: check parser
      // `flow` and `typescript` don't have `leadingComments`
      !original.leadingComments
    ) {
      removeTemplateElementsValue(clone);
    }
  }

  // Prettier removes degenerate union and intersection types with only one member.
  if (
    (original.type === "TSIntersectionType" ||
      original.type === "TSUnionType") &&
    original.types.length === 1
  ) {
    return clone.types[0];
  }

  // We print `(a?.b!).c` as `(a?.b)!.c`, but `typescript` parse them differently
  if (
    original.type === "ChainExpression" &&
    original.expression.type === "TSNonNullExpression"
  ) {
    // Ideally, we should swap these two nodes, but `type` is the only difference
    [clone.type, clone.expression.type] = [clone.expression.type, clone.type];
  }
}

clean.ignoredProperties = ignoredProperties;

export default clean;
