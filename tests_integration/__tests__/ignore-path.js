"use strict";

const runPrettier = require("../runPrettier");

describe("ignore path", () => {
  runPrettier("cli/ignore-path", [
    "**/*.js",
    "--ignore-path",
    ".gitignore",
    "-l"
  ]).test({
    status: 1
  });
});

describe("support multiple ignore-path", () => {
  runPrettier("cli/ignore-path", [
    "**/*.js",
    "--ignore-path",
    ".gitignore",
    "--ignore-path",
    ".prettierignore",
    "-l"
  ]).test({
    status: 0
  });
});

describe("support .prettierignore", () => {
  runPrettier("cli/ignore-path", ["**/*.js", "-l"]).test({
    status: 1
  });
});

describe("outputs files as-is if no --write", () => {
  runPrettier("cli/ignore-path", ["regular-module.js"]).test({
    status: 0
  });
});
