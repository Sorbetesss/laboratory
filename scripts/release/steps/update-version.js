"use strict";

const execa = require("execa");
const { logPromise, readJson, writeJson, processFile } = require("../utils");

async function bump({ version, previousVersion }) {
  const pkg = await readJson("package.json");
  pkg.version = version;
  await writeJson("package.json", pkg, { spaces: 2 });

  // Update github issue templates
  processFile(".github/ISSUE_TEMPLATE/formatting.md", content =>
    content.replace(/^(\*\*Prettier ).*?(\*\*)$/m, `$1${version}$2`)
  );
  processFile(".github/ISSUE_TEMPLATE/integration.md", content =>
    content.replace(/^(- Prettier Version: ).*?$/m, `$1${version}`)
  );

  // Update unpkg link in docs
  processFile("docs/browser.md", content => {
    const previousUnpkgLink = `https://unpkg.com/prettier@${previousVersion}/`;
    const unpkgLink = `https://unpkg.com/prettier@${version}/`;
    while (content.includes(previousUnpkgLink)) {
      content = content.replace(previousUnpkgLink, unpkgLink);
    }

    return content;
  });

  await execa("yarn", ["update-stable-docs"], {
    cwd: "./website"
  });
}

module.exports = async function(params) {
  await logPromise("Bumping version", bump(params));
};
