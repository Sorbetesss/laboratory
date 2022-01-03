"use strict";

const prettier = require("prettier-local");
const runPrettier = require("../runPrettier.js");

describe("infers postcss parser", () => {
  runPrettier("cli/with-parser-inference", ["--end-of-line", "lf", "*"]).test({
    status: 0,
  });
});

describe("infers postcss parser with --check", () => {
  runPrettier("cli/with-parser-inference", ["--check", "*"]).test({
    status: 0,
  });
});

describe("infers postcss parser with --list-different", () => {
  runPrettier("cli/with-parser-inference", ["--list-different", "*"]).test({
    status: 0,
  });
});

describe("infers parser from filename", () => {
  test("json from .prettierrc", () => {
    expect(prettier.format("  {   }  ", { filepath: "x/y/.prettierrc" })).toBe(
      "{}\n"
    );
  });

  test("json from .stylelintrc", () => {
    expect(prettier.format("  {   }  ", { filepath: "x/y/.stylelintrc" })).toBe(
      "{}\n"
    );
  });

  test("yaml from .stylelintrc", () => {
    expect(
      prettier.format("  extends:    ''  ", { filepath: "x/y/.stylelintrc" })
    ).toBe('extends: ""\n');
  });

  test("json5 from .parcelrc", () => {
    expect(
      prettier.format('  { "extends": "@parcel/config-default" }  ', {
        filepath: "x/y/.parcelrc",
      })
    ).toBe('{ extends: "@parcel/config-default" }\n');
  });

  test("json from .postcssrc", () => {
    expect(
      prettier.format('  { "extends": "@parcel/config-default" }  ', {
        filepath: "x/y/.postcssrc",
      })
    ).toBe('{ "extends": "@parcel/config-default" }\n');
  });

  test("yaml from .postcssrc", () => {
    expect(
      prettier.format("  plugins:     { }  ", { filepath: "x/y/.postcssrc" })
    ).toBe("plugins: {}\n");
  });

  test("json from .posthtmlrc", () => {
    expect(
      prettier.format('  { "extends": "@parcel/config-default" }  ', {
        filepath: "x/y/.posthtmlrc",
      })
    ).toBe('{ "extends": "@parcel/config-default" }\n');
  });

  test("yaml from .posthtmlrc", () => {
    expect(
      prettier.format("  plugins:     { }  ", { filepath: "x/y/.posthtmlrc" })
    ).toBe("plugins: {}\n");
  });

  test("json from .commitlintrc", () => {
    expect(
      prettier.format('  { "extends": [] }  ', {
        filepath: "x/y/.commitlintrc",
      })
    ).toBe('{ "extends": [] }\n');
  });

  test("yaml from .commitlintrc", () => {
    expect(
      prettier.format("  extends:     [ ]  ", { filepath: "x/y/.commitlintrc" })
    ).toBe("extends: []\n");
  });

  test("babel from Jakefile", () => {
    expect(
      prettier.format("let foo = ( x = 1 ) => x", { filepath: "x/y/Jakefile" })
    ).toBe("let foo = (x = 1) => x;\n");
  });
});
