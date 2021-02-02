"use strict";

const chalk = require("chalk");
const stripAnsi = require("strip-ansi");
const wcwidth = require("wcwidth");

const countLines = (stream, text) => {
  const columns = stream.columns || 80;
  let lineCount = 0;
  for (const line of stripAnsi(text).split("\n")) {
    lineCount += Math.max(1, Math.ceil(wcwidth(line) / columns));
  }
  return lineCount;
};

const clearLines = (stream, text) => () => {
  const lines = countLines(stream, text);

  for (let i = 0; i < lines; i++) {
    if (i > 0) {
      stream.moveCursor(0, -1);
    }

    stream.clearLine();
    stream.cursorTo(0);
  }
};

const emptyLogResult = { clear() {} };
function createLogger(logLevel) {
  return {
    warn: createLogFunc("warn", "yellow"),
    error: createLogFunc("error", "red"),
    debug: createLogFunc("debug", "blue"),
    log: createLogFunc("log"),
  };

  function createLogFunc(loggerName, color) {
    if (!shouldLog(loggerName)) {
      return () => emptyLogResult;
    }

    const prefix = color ? `[${chalk[color](loggerName)}] ` : "";
    const stream = process[loggerName === "log" ? "stdout" : "stderr"];

    return (message, options) => {
      options = {
        newline: true,
        clearable: false,
        ...options,
      };
      message = message.replace(/^/gm, prefix) + (options.newline ? "\n" : "");
      stream.write(message);

      if (options.clearable) {
        return {
          clear: clearLines(stream, message),
        };
      }
    };
  }

  function shouldLog(loggerName) {
    switch (logLevel) {
      case "silent":
        return false;
      case "debug":
        if (loggerName === "debug") {
          return true;
        }
      // fall through
      case "log":
        if (loggerName === "log") {
          return true;
        }
      // fall through
      case "warn":
        if (loggerName === "warn") {
          return true;
        }
      // fall through
      case "error":
        return loggerName === "error";
    }
  }
}

module.exports = { createLogger };
