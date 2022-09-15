import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { traverseFast as traverse } from "@babel/types";
import babelGenerator from "@babel/generator";
import { outdent } from "outdent";

const generate = babelGenerator.default;
const atHelperPath = fileURLToPath(new URL("../shims/at.js", import.meta.url));

/* Doesn't work for optional chaining and spread arguments */

// `Object.hasOwn(foo, "bar")` -> `Object.prototype.hasOwnProperty.call(foo, "bar")`
function transformObjectHasOwnCall(node) {
  if (
    !(
      node.type === "CallExpression" &&
      node.arguments.length === 2 &&
      node.arguments.every(({type}) => type !== "SpreadElement") &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "Object" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "hasOwn"
    )
  ) {
    return false;
  }

  node.callee = {
    type: "MemberExpression",
    object: {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "Object" },
        property: { type: "Identifier", name: "prototype" },
      },
      property: { type: "Identifier", name: "hasOwnProperty" },
    },
    property: { type: "Identifier", name: "call" },
  };

  return true;
}

// `foo.at(index)` -> `__at(foo, index)`
function transformRelativeIndexingCall(node) {
  if (
    !(
      node.type === "CallExpression" &&
      node.arguments.length === 1 &&
      node.arguments.every(({type}) => type !== "SpreadElement") &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.object.type !== "ThisExpression" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "at"
    )
  ) {
    return false;
  }

  node.arguments.unshift(node.object);
  node.callee = { type: "Identifier", name: "__at" };

  return true;
}

function transform(original, file) {
  if (
    file === atHelperPath ||
    (!original.includes(".at(") && !original.includes("Object.hasOwn("))
  ) {
    return original;
  }

  let changed = false;
  let shouldInjectRelativeIndexingHelper = false;
  const ast = parse(original, { sourceType: "module" });
  traverse(ast, (node) => {
    const hasObjectHasOwnCall = transformObjectHasOwnCall(node);
    changed ||= hasObjectHasOwnCall;

    const hasRelativeIndexingCall = transformRelativeIndexingCall(node);
    shouldInjectRelativeIndexingHelper ||= hasRelativeIndexingCall;
    changed ||= hasRelativeIndexingCall;
  });

  if (!changed) {
    return original;
  }

  let { code } = generate(ast);

  if (shouldInjectRelativeIndexingHelper) {
    code = outdent`
      import __at from ${JSON.stringify(atHelperPath)};

      ${code}
    `;
  }

  return code;
}

export default transform;
