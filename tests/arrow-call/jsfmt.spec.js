run_spec(__dirname, null, ["typescript"]);
run_spec(__dirname, { trailingComma: "all" }, ["typescript"]);
run_spec(__dirname, { arrowFnParens: "callbacks" }, ["typescript"]);
run_spec(__dirname, { arrowFnParens: "always" }, ["typescript"]);
