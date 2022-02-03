#!/usr/bin/env node

import createEsmUtils from "esm-utils";
import { readPackageUp } from "read-pkg-up";
import { getVendorVersions } from "./vendor-versions.mjs";
import vendors from "./vendors.mjs";

const { require } = createEsmUtils(import.meta);

async function main() {
  const errors = [];
  const verndorVersions = await getVendorVersions();
  for (const vendor of vendors) {
    const { packageJson: vendorPackage } = await readPackageUp({
      cwd: require.resolve(vendor),
    });
    const vendorPackageVersion = vendorPackage.version;
    const lockedVersion = verndorVersions[vendor];
    if (vendorPackageVersion !== lockedVersion) {
      errors.push({
        oldVersion: lockedVersion,
        newVersion: vendorPackageVersion,
        packageName: vendor,
      });
    }
  }
  if (errors.length > 0) {
    for (const { packageName, oldVersion, newVersion } of errors) {
      console.error(
        `The version of \`${packageName}\` is "${newVersion}", expected locked "${oldVersion}"`
      );
    }
    throw new Error(
      "Did you forget running `./scripts/vendors/bundle-vendors.mjs`?"
    );
  } else {
    console.log("Done");
  }
}

main();
