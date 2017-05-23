"use strict";

const runPrettier = require("../runPrettier");

test("ignores node_modules by default", () => {
  const { stdout, status } = runPrettier("cli/with-node-modules", [
    "**/*.js",
    "-l"
  ]);

  expect(stdout).toMatchSnapshot();
  expect(status).toBe(1);
});

test("doesn't ignore node_modules with --with-node-modules flag", () => {
  const { stdout, status } = runPrettier("cli/with-node-modules", [
    "**/*.js",
    "-l",
    "--with-node-modules"
  ]);

  expect(stdout).toMatchSnapshot();
  expect(status).toBe(1);
});

test("ignores node_modules by default for file list", () => {
  const { stdout, status } = runPrettier("cli/with-node-modules", [
    "node_modules/node-module.js",
    "not_node_modules/file.js",
    "regular-module.js",
    "-l"
  ]);

  expect(stdout).toMatchSnapshot();
  expect(status).toBe(1);
});

test("doesn't ignore node_modules with --with-node-modules flag for file list", () => {
  const { stdout, status } = runPrettier("cli/with-node-modules", [
    "node_modules/node-module.js",
    "not_node_modules/file.js",
    "regular-module.js",
    "-l",
    "--with-node-modules"
  ]);

  expect(stdout).toMatchSnapshot();
  expect(status).toBe(1);
});
