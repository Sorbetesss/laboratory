"use strict";

const path = require("path");
const fs = require("fs/promises");

const { default: stripAnsi } = require("../../../vendors/strip-ansi.js");

const runPrettier = require("../run-prettier.js");

function resolveDir(dir) {
  return path.join(__dirname, "..", dir);
}

function isJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

async function rm(file) {
  try {
    await fs.rm(file);
  } catch {
    // noop
  }
}

async function rmdir(dirPath) {
  try {
    await await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // noop
  }
}

describe("--cache-location option", () => {
  const dir = resolveDir("cli/cache-location");
  const defaultCacheFile = path.join(dir, ".prettiercache");
  const newCacheFile = path.join(dir, ".newprettiercache");
  const newCacheDir = path.join(dir, "cache-dir");

  afterEach(async () => {
    await rm(newCacheFile);
    await rmdir(newCacheDir);
  });

  it("doesn't create `.prettiercache` file when `--cache-location` is used.", async () => {
    await runPrettier(dir, [
      "--cache",
      "--cache-location=.newprettiercache",
      ".",
    ]);
    await expect(fs.stat(defaultCacheFile)).rejects.toHaveProperty(
      "code",
      "ENOENT"
    );
  });

  describe("specify file name", () => {
    it("creates cache file at the specified file", async () => {
      await runPrettier(dir, [
        "--cache",
        "--cache-location=.newprettiercache",
        ".",
      ]);
      const cacheFileData = await fs.readFile(newCacheFile, "utf8");
      await expect(isJson(cacheFileData)).toBe(true);
    });

    it("skips formatting when cache is available", async () => {
      await runPrettier(dir, [
        "--cache",
        "--cache-location=.newprettiercache",
        "--write",
        ".",
      ]);
      const { stdout } = await runPrettier(dir, [
        "--cache",
        "--cache-location=.newprettiercache",
        "--write",
        ".",
      ]);
      expect(stripAnsi(stdout).split("\n").filter(Boolean)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^a\.js .+ms \(cached\)$/),
          expect.stringMatching(/^b\.js .+ms \(cached\)$/),
        ])
      );
    });
  });

  describe("specify director name", () => {
    it("creates cache file into the specified directory", async () => {
      await runPrettier(dir, ["--cache", "--cache-location=cache-dir/", "."]);
      const fileNames = await fs.readdir(newCacheDir);
      expect(fileNames.length).toBe(1);
      const cacheFileName = fileNames[0];
      const filePath = path.join(newCacheDir, cacheFileName);
      const cacheFileData = await fs.readFile(filePath, "utf8");
      await expect(isJson(cacheFileData)).toBe(true);
    });

    it("skips formatting when cache is available", async () => {
      await runPrettier(dir, [
        "--cache",
        "--cache-location=cache-dir/",
        "--write",
        ".",
      ]);
      const { stdout } = await runPrettier(dir, [
        "--cache",
        "--cache-location=cache-dir/",
        "--write",
        ".",
      ]);
      expect(stripAnsi(stdout).split("\n").filter(Boolean)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^a\.js .+ms \(cached\)$/),
          expect.stringMatching(/^b\.js .+ms \(cached\)$/),
        ])
      );
    });
  });
});
