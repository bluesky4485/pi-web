"use strict";

// The published identity, read from this package's own package.json: every
// launcher message, run-record folder and update target derives from it, so a
// rename reaches all of them at once and can never tell the reader to run a
// command this package does not install.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../package.json");

const PKG_NAME = pkg.name;
const PKG_SCOPE = PKG_NAME.slice(1, PKG_NAME.indexOf("/"));
const PKG_BASE = PKG_NAME.slice(PKG_NAME.lastIndexOf("/") + 1);
const BIN_NAME = Object.keys(pkg.bin)[0];

module.exports = { BIN_NAME, PKG_BASE, PKG_NAME, PKG_SCOPE };
