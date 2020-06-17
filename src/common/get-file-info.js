"use strict";

const createIgnorer = require("./create-ignorer");
const options = require("../main/options");
const config = require("../config/resolve-config");
const path = require("path");

/**
 * @typedef {{ ignorePath?: string, withNodeModules?: boolean, plugins: object }} FileInfoOptions
 * @typedef {{ ignored: boolean, inferredParser: string | null }} FileInfoResult
 */

/**
 * @param {string} filePath
 * @param {FileInfoOptions} opts
 * @returns {Promise<FileInfoResult>}
 *
 * Please note that prettier.getFileInfo() expects opts.plugins to be an array of paths,
 * not an object. A transformation from this array to an object is automatically done
 * internally by the method wrapper. See withPlugins() in index.js.
 */
async function getFileInfo(filePath, opts) {
  if (typeof filePath !== "string") {
    throw new TypeError(
      `expect \`filePath\` to be a string, got \`${typeof filePath}\``
    );
  }

  const ignorer = await createIgnorer(opts.ignorePath, opts.withNodeModules);
  return _getFileInfo({
    ignorer,
    filePath: normalizeFilePath(filePath, opts.ignorePath),
    plugins: opts.plugins,
    resolveConfig: opts.resolveConfig,
    sync: false,
  });
}

/**
 * @param {string} filePath
 * @param {FileInfoOptions} opts
 * @returns {FileInfoResult}
 */
getFileInfo.sync = function (filePath, opts) {
  if (typeof filePath !== "string") {
    throw new TypeError(
      `expect \`filePath\` to be a string, got \`${typeof filePath}\``
    );
  }

  const ignorer = createIgnorer.sync(opts.ignorePath, opts.withNodeModules);
  return _getFileInfo({
    ignorer,
    filePath: normalizeFilePath(filePath, opts.ignorePath),
    plugins: opts.plugins,
    resolveConfig: opts.resolveConfig,
    sync: true,
  });
};

function getFileParser(resolvedConfig, filePath, plugins) {
  if (resolvedConfig && resolvedConfig.parser) {
    return resolvedConfig.parser;
  }

  const inferredParser = options.inferParser(filePath, plugins);

  if (inferredParser) {
    return inferredParser;
  }

  return null;
}

function _getFileInfo({
  ignorer,
  filePath,
  plugins,
  resolveConfig = false,
  sync = false,
}) {
  const fileInfo = {
    ignored: ignorer.ignores(filePath),
    inferredParser: null,
  };

  if (fileInfo.ignored) {
    return fileInfo;
  }

  let resolvedConfig;

  if (resolveConfig) {
    if (sync) {
      resolvedConfig = config.resolveConfig.sync(filePath);
    } else {
      return config.resolveConfig.then((resolvedConfig) => {
        fileInfo.inferredParser = getFileParser(
          resolvedConfig,
          filePath,
          plugins
        );
        return fileInfo;
      });
    }
  }

  fileInfo.inferredParser = getFileParser(resolvedConfig, filePath, plugins);
  return fileInfo;
}

function normalizeFilePath(filePath, ignorePath) {
  return ignorePath
    ? path.relative(path.dirname(ignorePath), filePath)
    : filePath;
}

module.exports = getFileInfo;
