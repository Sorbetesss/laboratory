"use strict";

const { runAstCompareTest } = require("../../tests_config/ast-compare-test");

runAstCompareTest({
  patterns: "babel/packages/babel-parser/test/fixtures/**/*",
  ignore: [
    "babel/packages/babel-parser/test/fixtures/typescript/**/*",
    "babel/packages/babel-parser/test/fixtures/flow/**/*",
    "babel/packages/babel-parser/test/fixtures/placeholders/**/*",
    "babel/packages/babel-parser/test/fixtures/v8intrinsic/**/*",
  ],
  options: { parser: "meriyah" },
});
