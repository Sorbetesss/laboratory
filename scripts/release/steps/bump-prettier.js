"use strict";

const { exec } = require("child-process-promise");
const { logPromise } = require("../utils");

async function format() {
  await exec("yarn lint --fix");
  await exec("yarn lint-docs --fix");
}

async function commit(version) {
  await exec(`git commit -am "Bump Prettier dependency to ${version}"`);
  await exec("git push");
}

module.exports = async function({ dry, version }) {
  if (dry) {
    return;
  }

  await logPromise(
    "Installing Prettier",
    exec(`yarn add --dev prettier@${version}`)
  );

  await logPromise("Updating files", format());
  await logPromise("Committing changed files", commit(version));
};
