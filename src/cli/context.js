"use strict";

const path = require("path");
const dashify = require("dashify");
const minimist = require("minimist");
const fs = require("fs");
const globby = require("globby");
const ignore = require("ignore");
const chalk = require("chalk");
const readline = require("readline");

const util = require("./util");
const normalizer = require("../main/options-normalizer");
const prettier = require("../../index");
const cleanAST = require("../common/clean-ast").cleanAST;
const errors = require("../common/errors");
const resolver = require("../config/resolve-config");
const constant = require("./constant");
const optionsModule = require("../main/options");
const apiDefaultOptions = optionsModule.defaults;
const optionsNormalizer = require("../main/options-normalizer");
const thirdParty = require("../common/third-party");
const optionInfos = require("../common/support").getSupportInfo(null, {
  showDeprecated: true,
  showUnreleased: true
}).options;

const OPTION_USAGE_THRESHOLD = 25;
const CHOICE_USAGE_MARGIN = 3;
const CHOICE_USAGE_INDENTATION = 2;

class Context {
  constructor(args) {
    const rawArgv = minimist(args, constant.minimistOptions);

    const logger = util.createLogger(
      rawArgv["loglevel"] || constant.detailedOptionMap["loglevel"].default
    );

    this.args = args;
    this.rawArgv = rawArgv;
    this.logger = logger;
  }

  init() {
    this.argv = normalizer.normalizeCliOptions(
      this.rawArgv,
      constant.detailedOptions,
      { logger: this.logger }
    );
    this.filePatterns = this.argv["_"];
  }

  getOptions(argv) {
    return constant.detailedOptions
      .filter(option => option.forwardToApi)
      .reduce(
        (current, option) =>
          Object.assign(current, {
            [option.forwardToApi]: argv[option.name]
          }),
        {}
      );
  }

  cliifyOptions(object) {
    return Object.keys(object || {}).reduce((output, key) => {
      const apiOption = constant.apiDetailedOptionMap[key];
      const cliKey = apiOption ? apiOption.name : key;

      output[dashify(cliKey)] = object[key];
      return output;
    }, {});
  }

  handleError(filename, error) {
    const isParseError = Boolean(error && error.loc);
    const isValidationError = /Validation Error/.test(error && error.message);

    // For parse errors and validation errors, we only want to show the error
    // message formatted in a nice way. `String(error)` takes care of that. Other
    // (unexpected) errors are passed as-is as a separate argument to
    // `console.error`. That includes the stack trace (if any), and shows a nice
    // `util.inspect` of throws things that aren't `Error` objects. (The Flow
    // parser has mistakenly thrown arrays sometimes.)
    if (isParseError) {
      this.logger.error(`${filename}: ${String(error)}`);
    } else if (isValidationError || error instanceof errors.ConfigError) {
      this.logger.error(String(error));
      // If validation fails for one file, it will fail for all of them.
      process.exit(1);
    } else if (error instanceof errors.DebugError) {
      this.logger.error(`${filename}: ${error.message}`);
    } else {
      this.logger.error(filename + ": " + (error.stack || error));
    }

    // Don't exit the process if one file failed
    process.exitCode = 2;
  }

  logResolvedConfigPathOrDie(filePath) {
    const configFile = resolver.resolveConfigFile.sync(filePath);
    if (configFile) {
      this.logger.log(path.relative(process.cwd(), configFile));
    } else {
      process.exit(1);
    }
  }

  writeOutput(result, options) {
    // Don't use `console.log` here since it adds an extra newline at the end.
    process.stdout.write(result.formatted);

    if (options.cursorOffset >= 0) {
      process.stderr.write(result.cursorOffset + "\n");
    }
  }

  listDifferent(input, options, filename) {
    if (!this.argv["list-different"]) {
      return;
    }

    options = Object.assign({}, options, { filepath: filename });

    if (!prettier.check(input, options)) {
      if (!this.argv["write"]) {
        this.logger.log(filename);
      }
      process.exitCode = 1;
    }

    return true;
  }

  format(input, opt) {
    if (this.argv["debug-print-doc"]) {
      const doc = prettier.__debug.printToDoc(input, opt);
      return { formatted: prettier.__debug.formatDoc(doc) };
    }

    if (this.argv["debug-check"]) {
      const pp = prettier.format(input, opt);
      const pppp = prettier.format(pp, opt);
      if (pp !== pppp) {
        throw new errors.DebugError(
          "prettier(input) !== prettier(prettier(input))\n" +
            util.createDiff(pp, pppp)
        );
      } else {
        const normalizedOpts = optionsModule.normalize(opt);
        const ast = cleanAST(
          prettier.__debug.parse(input, opt).ast,
          normalizedOpts
        );
        const past = cleanAST(
          prettier.__debug.parse(pp, opt).ast,
          normalizedOpts
        );

        if (ast !== past) {
          const MAX_AST_SIZE = 2097152; // 2MB
          const astDiff =
            ast.length > MAX_AST_SIZE || past.length > MAX_AST_SIZE
              ? "AST diff too large to render"
              : util.createDiff(ast, past);
          throw new errors.DebugError(
            "ast(input) !== ast(prettier(input))\n" +
              astDiff +
              "\n" +
              util.createDiff(input, pp)
          );
        }
      }
      return { formatted: opt.filepath || "(stdin)\n" };
    }

    return prettier.formatWithCursor(input, opt);
  }

  getOptionsOrDie(filePath) {
    try {
      if (this.argv["config"] === false) {
        this.logger.debug(
          "'--no-config' option found, skip loading config file."
        );
        return null;
      }

      this.logger.debug(
        this.argv["config"]
          ? `load config file from '${this.argv["config"]}'`
          : `resolve config from '${filePath}'`
      );
      const options = resolver.resolveConfig.sync(filePath, {
        editorconfig: this.argv.editorconfig,
        config: this.argv["config"]
      });

      this.logger.debug("loaded options `" + JSON.stringify(options) + "`");
      return options;
    } catch (error) {
      this.logger.error("Invalid configuration file: " + error.message);
      process.exit(2);
    }
  }

  getOptionsForFile(filepath) {
    const options = this.getOptionsOrDie(filepath);

    const appliedOptions = Object.assign(
      { filepath },
      this.applyConfigPrecedence(
        options &&
          optionsNormalizer.normalizeApiOptions(options, optionInfos, {
            logger: this.logger
          })
      )
    );

    this.logger.debug(
      `applied config-precedence (${this.argv["config-precedence"]}): ` +
        `${JSON.stringify(appliedOptions)}`
    );
    return appliedOptions;
  }

  parseArgsToOptions(overrideDefaults) {
    return this.getOptions(
      optionsNormalizer.normalizeCliOptions(
        minimist(
          this.args,
          Object.assign({
            string: constant.minimistOptions.string,
            boolean: constant.minimistOptions.boolean,
            default: Object.assign(
              {},
              this.cliifyOptions(apiDefaultOptions),
              this.cliifyOptions(overrideDefaults)
            )
          })
        ),
        constant.detailedOptions,
        { logger: false }
      )
    );
  }

  applyConfigPrecedence(options) {
    try {
      switch (this.argv["config-precedence"]) {
        case "cli-override":
          return this.parseArgsToOptions(options);
        case "file-override":
          return Object.assign({}, this.parseArgsToOptions(), options);
        case "prefer-file":
          return options || this.parseArgsToOptions();
      }
    } catch (error) {
      this.logger.error(error.toString());
      process.exit(2);
    }
  }

  formatStdin() {
    const filepath = this.argv["stdin-filepath"]
      ? path.resolve(process.cwd(), this.argv["stdin-filepath"])
      : process.cwd();

    const ignorer = this.createIgnorer();
    const relativeFilepath = path.relative(process.cwd(), filepath);

    thirdParty.getStream(process.stdin).then(input => {
      if (relativeFilepath && ignorer.filter([relativeFilepath]).length === 0) {
        this.writeOutput({ formatted: input }, {});
        return;
      }

      const options = this.getOptionsForFile(filepath);

      if (this.listDifferent(input, options, "(stdin)")) {
        return;
      }

      try {
        this.writeOutput(this.format(input, options), options);
      } catch (error) {
        this.handleError("stdin", error);
      }
    });
  }

  createIgnorer() {
    const ignoreFilePath = path.resolve(this.argv["ignore-path"]);
    let ignoreText = "";

    try {
      ignoreText = fs.readFileSync(ignoreFilePath, "utf8");
    } catch (readError) {
      if (readError.code !== "ENOENT") {
        this.logger.error(
          `Unable to read ${ignoreFilePath}: ` + readError.message
        );
        process.exit(2);
      }
    }

    return ignore().add(ignoreText);
  }

  eachFilename(patterns, callback) {
    const ignoreNodeModules = this.argv["with-node-modules"] === false;
    if (ignoreNodeModules) {
      patterns = patterns.concat(["!**/node_modules/**", "!./node_modules/**"]);
    }

    try {
      const filePaths = globby
        .sync(patterns, { dot: true, nodir: true })
        .map(filePath => path.relative(process.cwd(), filePath));

      if (filePaths.length === 0) {
        this.logger.error(
          `No matching files. Patterns tried: ${patterns.join(" ")}`
        );
        process.exitCode = 2;
        return;
      }
      filePaths.forEach(filePath =>
        callback(filePath, this.getOptionsForFile(filePath))
      );
    } catch (error) {
      this.logger.error(
        `Unable to expand glob patterns: ${patterns.join(" ")}\n${
          error.message
        }`
      );
      // Don't exit the process if one pattern failed
      process.exitCode = 2;
    }
  }

  formatFiles() {
    // The ignorer will be used to filter file paths after the glob is checked,
    // before any files are actually written
    const ignorer = this.createIgnorer();

    this.eachFilename(this.filePatterns, (filename, options) => {
      const fileIgnored = ignorer.filter([filename]).length === 0;
      if (fileIgnored && (this.argv["write"] || this.argv["list-different"])) {
        return;
      }

      if (this.argv["write"] && process.stdout.isTTY) {
        // Don't use `console.log` here since we need to replace this line.
        this.logger.log(filename, { newline: false });
      }

      let input;
      try {
        input = fs.readFileSync(filename, "utf8");
      } catch (error) {
        // Add newline to split errors from filename line.
        this.logger.log("");

        this.logger.error(`Unable to read file: ${filename}\n${error.message}`);
        // Don't exit the process if one file failed
        process.exitCode = 2;
        return;
      }

      if (fileIgnored) {
        this.writeOutput({ formatted: input }, options);
        return;
      }

      this.listDifferent(input, options, filename);

      const start = Date.now();

      let result;
      let output;

      try {
        result = this.format(
          input,
          Object.assign({}, options, { filepath: filename })
        );
        output = result.formatted;
      } catch (error) {
        // Add newline to split errors from filename line.
        process.stdout.write("\n");

        this.handleError(filename, error);
        return;
      }

      if (this.argv["write"]) {
        if (process.stdout.isTTY) {
          // Remove previously printed filename to log it with duration.
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0, null);
        }

        // Don't write the file if it won't change in order not to invalidate
        // mtime based caches.
        if (output === input) {
          if (!this.argv["list-different"]) {
            this.logger.log(`${chalk.grey(filename)} ${Date.now() - start}ms`);
          }
        } else {
          if (this.argv["list-different"]) {
            this.logger.log(filename);
          } else {
            this.logger.log(`${filename} ${Date.now() - start}ms`);
          }

          try {
            fs.writeFileSync(filename, output, "utf8");
          } catch (error) {
            this.logger.error(
              `Unable to write file: ${filename}\n${error.message}`
            );
            // Don't exit the process if one file failed
            process.exitCode = 2;
          }
        }
      } else if (this.argv["debug-check"]) {
        if (output) {
          this.logger.log(output);
        } else {
          process.exitCode = 2;
        }
      } else if (!this.argv["list-different"]) {
        this.writeOutput(result, options);
      }
    });
  }

  createUsage() {
    return util.createUsage(
      constant.usageSummary,
      OPTION_USAGE_THRESHOLD,
      constant.categoryOrder,
      constant.detailedOptionMap,
      apiDefaultOptions
    );
  }

  createDetailedUsage(optionName) {
    const option = util.getOptionWithLevenSuggestion(
      util.getOptionsWithOpposites(constant.detailedOptions),
      optionName,
      this.logger
    );
    return util.createDetailedUsage(
      option,
      CHOICE_USAGE_MARGIN,
      CHOICE_USAGE_INDENTATION,
      constant.detailedOptionMap,
      apiDefaultOptions
    );
  }
}

module.exports = Context;
