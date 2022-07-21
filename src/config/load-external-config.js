import { createRequire } from "node:module";
import { importFromFile } from "./import-from.js";

async function loadExternalConfig(config, filepath) {
  /*
  Try `require()` first, this is how it works in Prettier v2.
  Kept this because the external config path or package may can't load with `import()`:
  1. is JSON file or package
  2. is CommonJS file without extension
  3. is a dirname with index.js inside
  */
  try {
    return createRequire(filepath)(config);
  } catch (error) {
    if (
      error?.code !== "MODULE_NOT_FOUND" &&
      error?.code !== "ERR_REQUIRE_ESM"
    ) {
      throw error;
    }
  }

  const module = await importFromFile(config, filepath);
  return module.default;
}

export default loadExternalConfig;
