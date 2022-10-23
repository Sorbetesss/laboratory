"use strict";

const path = require("path");
const { promises: fs } = require("fs");
const rimraf = require("rimraf");
const { default: stripAnsi } = require("../../../vendors/strip-ansi.js");

const runPrettier = require("../run-prettier.js");

function resolveDir(dir) {
  return path.join(__dirname, "..", dir);
}

describe("--cache option", () => {
  const dir = resolveDir("cli/cache");
  const defaultCacheFile = path.join(
    dir,
    "node_modules/.cache/prettier/.prettier-cache"
  );

  const nonDefaultCacheFileName = ".non-default-cache-file";
  const nonDefaultCacheFilePath = path.join(dir, nonDefaultCacheFileName);

  let contentA;
  let contentB;

  beforeAll(async () => {
    contentA = await fs.readFile(path.join(dir, "a.js"), "utf8");
    contentB = await fs.readFile(path.join(dir, "b.js"), "utf8");
  });

  afterEach(async () => {
    rimraf.sync(path.join(dir, "node_modules"));
    rimraf.sync(nonDefaultCacheFilePath);
    await fs.writeFile(path.join(dir, "a.js"), contentA);
    await fs.writeFile(path.join(dir, "b.js"), contentB);
  });

  it("throw error when cache-strategy is invalid", async () => {
    const { stderr } = await runPrettier(dir, [
      "--cache",
      "--cache-strategy",
      "invalid",
      ".",
    ]);
    expect(stripAnsi(stderr.trim())).toBe(
      '[error] Invalid --cache-strategy value. Expected "content" or "metadata", but received "invalid".'
    );
  });

  it("throws error when use with --stdin-filepath", async () => {
    const { stderr } = await runPrettier(
      dir,
      ["--cache", "--stdin-filepath", "foo.js"],
      { input: "const a = a;" }
    );
    expect(stripAnsi(stderr.trim())).toBe(
      "[error] `--cache` cannot be used with stdin."
    );
  });

  it("throws error when use `--cache-strategy` without `--cache`.", async () => {
    const { stderr } = await runPrettier(
      dir,
      ["foo.js", "--cache-strategy", "content"],
      {
        input: "const a = a;",
      }
    );
    expect(stripAnsi(stderr.trim())).toBe(
      "[error] `--cache-strategy` cannot be used without `--cache`."
    );
  });

  it("throws error when `--cache-location` is a directory.", async () => {
    const { stderr } = await runPrettier(dir, [
      "foo.js",
      "--cache",
      "--cache-location",
      "dir",
    ]);
    expect(stripAnsi(stderr.trim())).toEqual(
      expect.stringMatching(
        /\[error] Resolved --cache-location '.+' is a directory/
      )
    );
  });

  describe("--cache-strategy", () => {
    const createGetCliArguments =
      (strategy) =>
      (
        { write, listDifferent, trailingCommaAll } = {
          write: false,
          listDifferent: false,
          trailingCommaAll: false,
        }
      ) =>
        [
          "--cache",
          "--cache-strategy",
          strategy,
          write && "--write",
          listDifferent && "--list-different",
          trailingCommaAll && "--trailing-comma",
          trailingCommaAll && "all",
          ".",
        ].filter(Boolean);

    describe("--cache-strategy metadata", () => {
      const getCliArguments = createGetCliArguments("metadata");

      it("creates default cache file named `node_modules/.cache/prettier/.prettier-cache`", async () => {
        await expect(fs.stat(defaultCacheFile)).rejects.toHaveProperty(
          "code",
          "ENOENT"
        );
        await runPrettier(dir, getCliArguments());
        await expect(fs.stat(defaultCacheFile)).resolves.not.toThrowError();
      });

      it("doesn't format when cache is available", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms \(cached\)$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when a file has been updated.", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        // Update `a.js`
        await fs.writeFile(path.join(dir, "a.js"), "const a = `a`;");

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          // the cache of `b.js` is only available.
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when timestamp has been updated", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        // update timestamp
        const time = new Date();
        await fs.utimes(path.join(dir, "a.js"), time, time);

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          // the cache of `b.js` is only available.
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when options has been updated.", async () => {
        const { stdout: firstStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true, trailingCommaAll: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );
      });

      it("re-formats after execution without write.", async () => {
        await runPrettier(dir, getCliArguments());

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when multiple cached files are updated.", async () => {
        await runPrettier(dir, getCliArguments({ write: true }));

        // Update `a.js` to unformatted
        await fs.writeFile(path.join(dir, "a.js"), "const a = `a`;    ");

        // Update `b.js` but still formatted
        const time = new Date();
        await fs.utimes(path.join(dir, "b.js"), time, time);

        await runPrettier(dir, getCliArguments());

        const { stdout: thirdStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(thirdStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("doesn't cache files when write error.", async () => {
        const {
          stdout: firstStdout,
          stderr: firstStderr,
          status: firstStatus,
        } = await runPrettier(dir, getCliArguments({ write: true }), {
          mockWriteFileErrors: {
            "a.js": "EACCES: permission denied (mock error)",
          },
        });
        expect(firstStatus).toBe(2);
        expect(stripAnsi(firstStderr).split("\n").filter(Boolean)).toEqual([
          "[error] Unable to write file: a.js",
          "[error] EACCES: permission denied (mock error)",
        ]);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ write: false, listDifferent: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual([
          "a.js",
        ]);
      });

      it("removes cache file when run Prettier without `--cache` option", async () => {
        await runPrettier(dir, getCliArguments({ write: true }));
        await expect(fs.stat(defaultCacheFile)).resolves.not.toThrowError();
        await runPrettier(dir, ["--write", "."]);
        await expect(fs.stat(defaultCacheFile)).rejects.toThrowError();
      });
    });

    describe("--cache-strategy content", () => {
      const getCliArguments = createGetCliArguments("content");

      it("creates default cache file named `node_modules/.cache/prettier/.prettier-cache`", async () => {
        await expect(fs.stat(defaultCacheFile)).rejects.toHaveProperty(
          "code",
          "ENOENT"
        );
        await runPrettier(dir, getCliArguments());
        await expect(fs.stat(defaultCacheFile)).resolves.not.toThrowError();
      });

      it("doesn't format when cache is available", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms \(cached\)$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when a file has been updated.", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        // Update `a.js`
        await fs.writeFile(path.join(dir, "a.js"), "const a = `a`;");

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          // the cache of `b.js` is only available.
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("doesn't re-format when timestamp has been updated", async () => {
        const cliArguments = getCliArguments({ write: true });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        // update timestamp
        const time = new Date();
        await fs.utimes(path.join(dir, "a.js"), time, time);

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms \(cached\)$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when options has been updated.", async () => {
        const { stdout: firstStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true, trailingCommaAll: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );
      });

      it("re-formats after execution without write.", async () => {
        await runPrettier(dir, ["--cache", "--cache-strategy", "content", "."]);

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("re-formats when multiple cached files are updated.", async () => {
        await runPrettier(dir, getCliArguments({ write: true }));

        // Update `a.js` to unformatted
        await fs.writeFile(path.join(dir, "a.js"), "const a = `a`;    ");

        // Update `b.js` but still formatted
        const time = new Date();
        await fs.utimes(path.join(dir, "b.js"), time, time);

        await runPrettier(dir, getCliArguments());

        const { stdout: thirdStdout } = await runPrettier(
          dir,
          getCliArguments({ write: true })
        );
        expect(stripAnsi(thirdStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });

      it("doesn't cache files when write error.", async () => {
        const {
          stdout: firstStdout,
          stderr: firstStderr,
          status: firstStatus,
        } = await runPrettier(dir, getCliArguments({ write: true }), {
          mockWriteFileErrors: {
            "a.js": "EACCES: permission denied (mock error)",
          },
        });
        expect(firstStatus).toBe(2);
        expect(stripAnsi(firstStderr).split("\n").filter(Boolean)).toEqual([
          "[error] Unable to write file: a.js",
          "[error] EACCES: permission denied (mock error)",
        ]);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(
          dir,
          getCliArguments({ listDifferent: true })
        );
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual([
          "a.js",
        ]);
      });

      it("removes cache file when run Prettier without `--cache` option", async () => {
        await runPrettier(dir, getCliArguments({ write: true }));
        await expect(fs.stat(defaultCacheFile)).resolves.not.toThrowError();
        await runPrettier(dir, ["--write", "."]);
        await expect(fs.stat(defaultCacheFile)).rejects.toThrowError();
      });
    });
  });

  describe("--cache-location", () => {
    const getCliArguments = (
      { write, cacheLocation } = { write: false, cacheLocation: undefined }
    ) =>
      [
        "--cache",
        write && "--write",
        cacheLocation && "--cache-location",
        cacheLocation,
        ".",
      ].filter(Boolean);

    it("doesn't create default cache file when `--cache-location` exists", async () => {
      await expect(fs.stat(defaultCacheFile)).rejects.toHaveProperty(
        "code",
        "ENOENT"
      );
      await runPrettier(
        dir,
        getCliArguments({
          cacheLocation: nonDefaultCacheFileName,
        })
      );
      await expect(fs.stat(defaultCacheFile)).rejects.toHaveProperty(
        "code",
        "ENOENT"
      );
    });

    it("throws error for invalid JSON file", async () => {
      const { stderr } = await runPrettier(
        dir,
        getCliArguments({
          cacheLocation: "a.js",
        })
      );
      expect(stripAnsi(stderr).trim()).toEqual(
        expect.stringMatching(/\[error] '.+' isn't a valid JSON file/)
      );
    });

    describe("file", () => {
      it("creates the cache file at location specified by `--cache-location`", async () => {
        await expect(fs.stat(nonDefaultCacheFilePath)).rejects.toHaveProperty(
          "code",
          "ENOENT"
        );
        await runPrettier(
          dir,
          getCliArguments({
            cacheLocation: nonDefaultCacheFileName,
          })
        );
        await expect(
          fs.stat(nonDefaultCacheFilePath)
        ).resolves.not.toThrowError();
      });

      it("does'nt format when cache is available", async () => {
        const cliArguments = getCliArguments({
          write: true,
          cacheLocation: nonDefaultCacheFileName,
        });
        const { stdout: firstStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(firstStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms$/),
            expect.stringMatching(/^b\.js .+ms$/),
          ])
        );

        const { stdout: secondStdout } = await runPrettier(dir, cliArguments);
        expect(stripAnsi(secondStdout).split("\n").filter(Boolean)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^a\.js .+ms \(cached\)$/),
            expect.stringMatching(/^b\.js .+ms \(cached\)$/),
          ])
        );
      });
    });
  });
});
