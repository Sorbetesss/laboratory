// Only testing babel parsing
// Do not add extra parsers here

run_spec(__dirname, ["babel", "babel-ts", "babel-flow"], {
  errors: {
    espree: [
      "decimal.js",
      "decorators.js",
      "do-expressions.js",
      "export-default-from.js",
      "flow.js",
      "function-bind.js",
      "function-sent.js",
      "import-assertions-dynamic.js",
      "import-assertions-static.js",
      "partial-application.js",
      "pipeline-operator-fsharp.js",
      "pipeline-operator-minimal.js",
      "pipeline-operator-hack.js",
      "record-tuple-record.js",
      "record-tuple-tuple.js",
      "throw-expressions.js",
      "typescript.js",
      "v8intrinsic.js",
      "module-string-names.js",
      "module-blocks.js",
      "async-do-expressions.js",
    ],
    meriyah: [
      "decimal.js",
      "do-expressions.js",
      "export-default-from.js",
      "flow.js",
      "function-bind.js",
      "function-sent.js",
      "module-attributes-dynamic.js",
      "module-attributes-static.js",
      "partial-application.js",
      "pipeline-operator-fsharp.js",
      "pipeline-operator-minimal.js",
      "pipeline-operator-hack.js",
      "record-tuple-record.js",
      "record-tuple-tuple.js",
      "throw-expressions.js",
      "typescript.js",
      "v8intrinsic.js",
      "class-static-block.js",
      "import-assertions-dynamic.js",
      "import-assertions-static.js",
      "module-string-names.js",
      "module-blocks.js",
      "async-do-expressions.js",
    ],
  },
});
