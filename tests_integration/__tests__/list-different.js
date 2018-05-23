"use strict";

const runPrettier = require("../runPrettier");

describe("checks stdin with --list-different", () => {
  runPrettier("cli/with-shebang", ["--list-different", "--parser", "babylon"], {
    input: "0"
  }).test({
    stdout: "(stdin)\n",
    stderr: "",
    status: "non-zero"
  });
});
