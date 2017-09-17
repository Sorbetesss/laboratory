"use strict";

const path = require("path");
const dashify = require("dashify");
const minimist = require("minimist");
const getStream = require("get-stream");
const fs = require("fs");
const globby = require("globby");
const ignore = require("ignore");
const chalk = require("chalk");
const readline = require("readline");
const leven = require("leven");

const prettier = eval("require")("../index");
const cleanAST = require("./clean-ast").cleanAST;
const resolver = require("./resolve-config");
const constant = require("./cli-constant");
const validator = require("./cli-validator");
const apiDefaultOptions = require("./options").defaults;

const OPTION_USAGE_THRESHOLD = 25;

function getOptions(argv) {
  return constant.detailedOptions
    .filter(option => option.forwardToApi)
    .reduce(
      (current, option) =>
        Object.assign(current, { [option.forwardToApi]: argv[option.name] }),
      {}
    );
}

function dashifyObject(object) {
  return Object.keys(object || {}).reduce((output, key) => {
    output[dashify(key)] = object[key];
    return output;
  }, {});
}

function diff(a, b) {
  return require("diff").createTwoFilesPatch("", "", a, b, "", "", {
    context: 2
  });
}

function handleError(filename, error) {
  const isParseError = Boolean(error && error.loc);
  const isValidationError = /Validation Error/.test(error && error.message);

  // For parse errors and validation errors, we only want to show the error
  // message formatted in a nice way. `String(error)` takes care of that. Other
  // (unexpected) errors are passed as-is as a separate argument to
  // `console.error`. That includes the stack trace (if any), and shows a nice
  // `util.inspect` of throws things that aren't `Error` objects. (The Flow
  // parser has mistakenly thrown arrays sometimes.)
  if (isParseError) {
    console.error(`${filename}: ${String(error)}`);
  } else if (isValidationError) {
    console.error(String(error));
    // If validation fails for one file, it will fail for all of them.
    process.exit(1);
  } else {
    console.error(filename + ":", error.stack || error);
  }

  // Don't exit the process if one file failed
  process.exitCode = 2;
}

function logResolvedConfigPathOrDie(filePath) {
  const configFile = resolver.resolveConfigFile.sync(filePath);
  if (configFile) {
    console.log(path.relative(process.cwd(), configFile));
  } else {
    process.exit(1);
  }
}

function writeOutput(result, options) {
  // Don't use `console.log` here since it adds an extra newline at the end.
  process.stdout.write(result.formatted);

  if (options.cursorOffset >= 0) {
    process.stderr.write(result.cursorOffset + "\n");
  }
}

function listDifferent(argv, input, options, filename) {
  if (!argv["list-different"]) {
    return;
  }

  options = Object.assign({}, options, { filepath: filename });

  if (!prettier.check(input, options)) {
    if (!argv["write"]) {
      console.log(filename);
    }
    process.exitCode = 1;
  }

  return true;
}

function format(argv, input, opt) {
  if (argv["debug-print-doc"]) {
    const doc = prettier.__debug.printToDoc(input, opt);
    return { formatted: prettier.__debug.formatDoc(doc) };
  }

  if (argv["debug-check"]) {
    const pp = prettier.format(input, opt);
    const pppp = prettier.format(pp, opt);
    if (pp !== pppp) {
      throw "prettier(input) !== prettier(prettier(input))\n" + diff(pp, pppp);
    } else {
      const ast = cleanAST(prettier.__debug.parse(input, opt));
      const past = cleanAST(prettier.__debug.parse(pp, opt));

      if (ast !== past) {
        const MAX_AST_SIZE = 2097152; // 2MB
        const astDiff =
          ast.length > MAX_AST_SIZE || past.length > MAX_AST_SIZE
            ? "AST diff too large to render"
            : diff(ast, past);
        throw "ast(input) !== ast(prettier(input))\n" +
          astDiff +
          "\n" +
          diff(input, pp);
      }
    }
    return { formatted: opt.filepath || "(stdin)\n" };
  }

  return prettier.formatWithCursor(input, opt);
}

function getOptionsOrDie(argv, filePath) {
  try {
    return argv["config"] === false
      ? null
      : resolver.resolveConfig.sync(filePath, { config: argv["config"] });
  } catch (error) {
    console.error("Error: Invalid configuration file.");
    console.error(error.message);
    process.exit(2);
  }
}

function getOptionsForFile(argv, filePath) {
  const options = getOptionsOrDie(argv, filePath);
  return applyConfigPrecedence(argv, options);
}

function parseArgsToOptions(argv, overrideDefaults) {
  return getOptions(
    normalizeArgv(
      minimist(
        argv.__args,
        Object.assign({
          string: constant.minimistOptions.string,
          boolean: constant.minimistOptions.boolean,
          default: Object.assign(
            {},
            dashifyObject(apiDefaultOptions),
            dashifyObject(overrideDefaults)
          )
        })
      ),
      { warning: false }
    )
  );
}

function applyConfigPrecedence(argv, options) {
  try {
    switch (argv["config-precedence"]) {
      case "cli-override":
        return parseArgsToOptions(argv, options);
      case "file-override":
        return Object.assign({}, parseArgsToOptions(argv), options);
      case "prefer-file":
        return options || parseArgsToOptions(argv);
    }
  } catch (error) {
    console.error(error.toString());
    process.exit(2);
  }
}

function formatStdin(argv) {
  getStream(process.stdin).then(input => {
    const options = getOptionsForFile(argv, process.cwd());

    if (listDifferent(argv, input, options, "(stdin)")) {
      return;
    }

    try {
      writeOutput(format(argv, input, options), options);
    } catch (error) {
      handleError("stdin", error);
    }
  });
}

function eachFilename(argv, patterns, callback) {
  const ignoreNodeModules = argv["with-node-modules"] === false;
  // The ignorer will be used to filter file paths after the glob is checked,
  // before any files are actually read
  const ignoreFilePath = path.resolve(argv["ignore-path"]);
  let ignoreText = "";

  try {
    ignoreText = fs.readFileSync(ignoreFilePath, "utf8");
  } catch (readError) {
    if (readError.code !== "ENOENT") {
      console.error(`Unable to read ${ignoreFilePath}:`, readError);
      process.exit(2);
    }
  }

  const ignorer = ignore().add(ignoreText);

  if (ignoreNodeModules) {
    patterns = patterns.concat(["!**/node_modules/**", "!./node_modules/**"]);
  }

  try {
    const filePaths = globby
      .sync(patterns, { dot: true })
      .map(
        filePath =>
          path.isAbsolute(filePath)
            ? path.relative(process.cwd(), filePath)
            : filePath
      );
    if (filePaths.length === 0) {
      console.error(`No matching files. Patterns tried: ${patterns.join(" ")}`);
      process.exitCode = 2;
      return;
    }
    ignorer
      .filter(filePaths)
      .forEach(filePath =>
        callback(filePath, getOptionsForFile(argv, filePath))
      );
  } catch (error) {
    console.error(
      `Unable to expand glob patterns: ${patterns.join(" ")}\n${error}`
    );
    // Don't exit the process if one pattern failed
    process.exitCode = 2;
  }
}

function formatFiles(argv) {
  eachFilename(argv, argv.__filePatterns, (filename, options) => {
    if (argv["write"]) {
      // Don't use `console.log` here since we need to replace this line.
      process.stdout.write(filename);
    }

    let input;
    try {
      input = fs.readFileSync(filename, "utf8");
    } catch (error) {
      // Add newline to split errors from filename line.
      process.stdout.write("\n");

      console.error(`Unable to read file: ${filename}\n${error}`);
      // Don't exit the process if one file failed
      process.exitCode = 2;
      return;
    }

    listDifferent(argv, input, options, filename);

    const start = Date.now();

    let result;
    let output;

    try {
      result = format(
        argv,
        input,
        Object.assign({}, options, { filepath: filename })
      );
      output = result.formatted;
    } catch (error) {
      // Add newline to split errors from filename line.
      process.stdout.write("\n");

      handleError(filename, error);
      return;
    }

    if (argv["write"]) {
      // Remove previously printed filename to log it with duration.
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0, null);

      // Don't write the file if it won't change in order not to invalidate
      // mtime based caches.
      if (output === input) {
        if (!argv["list-different"]) {
          console.log(chalk.grey("%s %dms"), filename, Date.now() - start);
        }
      } else {
        if (argv["list-different"]) {
          console.log(filename);
        } else {
          console.log("%s %dms", filename, Date.now() - start);
        }

        try {
          fs.writeFileSync(filename, output, "utf8");
        } catch (error) {
          console.error(`Unable to write file: ${filename}\n${error}`);
          // Don't exit the process if one file failed
          process.exitCode = 2;
        }
      }
    } else if (argv["debug-check"]) {
      if (output) {
        console.log(output);
      } else {
        process.exitCode = 2;
      }
    } else if (!argv["list-different"]) {
      writeOutput(result, options);
    }
  });
}

function createUsage() {
  const options = constant.detailedOptions;
  // Add --no-foo after --foo.
  const optionsWithOpposites = options.map(option => [
    option.description ? option : null,
    option.oppositeDescription
      ? Object.assign({}, option, {
          name: `no-${option.name}`,
          type: "boolean",
          description: option.oppositeDescription
        })
      : null
  ]);
  const flattenedOptions = [].concat
    .apply([], optionsWithOpposites)
    .filter(Boolean);

  const groupedOptions = groupBy(flattenedOptions, option => option.category);

  const firstCategories = constant.categoryOrder.slice(0, -1);
  const lastCategories = constant.categoryOrder.slice(-1);
  const restCategories = Object.keys(groupedOptions).filter(
    category =>
      firstCategories.indexOf(category) === -1 &&
      lastCategories.indexOf(category) === -1
  );
  const allCategories = firstCategories.concat(restCategories, lastCategories);

  const optionsUsage = allCategories.map(category => {
    const categoryOptions = groupedOptions[category]
      .map(option => createOptionUsage(option, OPTION_USAGE_THRESHOLD))
      .join("\n");
    return `${category} options:\n\n${indent(categoryOptions, 2)}`;
  });

  return [constant.usageSummary].concat(optionsUsage, [""]).join("\n\n");
}

function createOptionUsage(option, threshold) {
  const name = `--${option.name}`;
  const alias = option.alias ? `or -${option.alias}` : null;
  const type = createOptionUsageType(option);
  const header = [name, alias, type].filter(Boolean).join(" ");
  return createOptionUsageRow(header, option.description, threshold);
}

function createOptionUsageRow(header, content, threshold) {
  const separator =
    header.length >= threshold
      ? `\n${" ".repeat(threshold)}`
      : " ".repeat(threshold - header.length);

  const description = content.replace(/\n/g, `\n${" ".repeat(threshold)}`);

  return `${header}${separator}${description}`;
}

function createOptionUsageType(option) {
  switch (option.type) {
    case "boolean":
      return null;
    case "choice":
      return `<${option.choices
        .filter(choice => !choice.deprecated)
        .map(choice => choice.value)
        .join("|")}>`;
    default:
      return `<${option.type}>`;
  }
}

function createDetailedUsage(optionName) {
  const optionNames = Object.keys(constant.detailedOptionMap);

  if (optionNames.indexOf(optionName) === -1) {
    const suggestion = optionNames.find(
      option => leven(option, optionName) < 3
    );

    if (suggestion) {
      console.warn(
        `Unexpected option name "${optionName}", did you mean "${suggestion}"?\n`
      );
      optionName = suggestion;
    } else {
      throw new Error(`Unexpected option name "${optionName}"`);
    }
  }

  const option = constant.detailedOptionMap[optionName];

  const optionTitleName = kebabToTitle(optionName);
  const optionCamelName = kebabToCamel(optionName);

  const optionType = createOptionUsageType(option);

  const header = `${optionTitleName} (--${optionName} ${optionType})`;

  const description = `\n\n${indent(option.description, 2)}`;

  const choices =
    option.type !== "choice"
      ? ""
      : (() => {
          const choices = option.choices.filter(choice => !choice.deprecated);
          const threshold =
            choices
              .map(choice => choice.value.length)
              .reduce((current, length) => Math.max(current, length), 0) + 3;
          const choiceUsages = choices.map(choice =>
            indent(
              createOptionUsageRow(choice.value, choice.description, threshold),
              2
            )
          );
          return `\n\nValid options:\n\n${choiceUsages.join("\n")}`;
        })();

  const defaults =
    option.default !== undefined
      ? `\n\nDefault: ${option.default}`
      : optionCamelName in apiDefaultOptions
        ? `\n\nDefault: ${apiDefaultOptions[optionCamelName]}`
        : "";

  return `${header}${description}${choices}${defaults}`;
}

function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function kebabToTitle(str) {
  return str.replace(
    /(^|-)([a-z])/g,
    (_, prefix, char) => " ".repeat(prefix.length) + char.toUpperCase()
  );
}

function indent(str, spaces) {
  return str.replace(/^/gm, " ".repeat(spaces));
}

function groupBy(array, getKey) {
  return array.reduce((obj, item) => {
    const key = getKey(item);
    const previousItems = key in obj ? obj[key] : [];
    return Object.assign({}, obj, { [key]: previousItems.concat(item) });
  }, Object.create(null));
}

function normalizeArgv(rawArgv, options) {
  options = options || {};

  const consoleWarn = options.warning === false ? () => {} : console.warn;

  const normalized = {};

  Object.keys(rawArgv).forEach(key => {
    const rawValue = rawArgv[key];

    if (key === "_") {
      normalized[key] = rawValue;
      return;
    }

    if (key.length === 1) {
      // do nothing with alias
      return;
    }

    const option = constant.detailedOptionMap[key];

    if (option === undefined) {
      // unknown option
      return;
    }

    const value = getValue(rawValue, option);

    if (option.exception !== undefined) {
      if (typeof option.exception === "function") {
        if (option.exception(value)) {
          normalized[key] = value;
          return;
        }
      } else {
        if (value === option.exception) {
          normalized[key] = value;
          return;
        }
      }
    }

    switch (option.type) {
      case "int":
        validator.validateIntOption(value, option);
        normalized[key] = Number(value);
        break;
      case "choice":
        validator.validateChoiceOption(value, option);
        normalized[key] = value;
        break;
      default:
        normalized[key] = value;
        break;
    }
  });

  return normalized;

  function getValue(rawValue, option) {
    if (rawValue && option.deprecated) {
      let warning = `\`--${option.name}\` is deprecated.`;
      if (typeof option.deprecated === "string") {
        warning += ` ${option.deprecated}`;
      }
      consoleWarn(warning);
    }

    const value = option.getter(rawValue, rawArgv);

    if (option.type === "choice") {
      const choice = option.choices.find(choice => choice.value === rawValue);
      if (choice !== undefined && choice.deprecated) {
        const warningDescription =
          rawValue === ""
            ? "without an argument"
            : `with value \`${rawValue}\``;
        consoleWarn(
          `\`--${option.name}\` ${warningDescription} is deprecated. Prettier now treats it as: \`--${option.name}=${choice.redirect}\`.`
        );
        return choice.redirect;
      }
    }

    return value;
  }
}

module.exports = {
  logResolvedConfigPathOrDie,
  format,
  formatStdin,
  formatFiles,
  createUsage,
  createDetailedUsage,
  normalizeArgv
};
