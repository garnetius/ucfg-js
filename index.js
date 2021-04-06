/* ================================= $ J $ =====================================
// UCFG Node.js test program.
// -------------------------------------------------------------------------- */

"use strict"

import {Core} from "../core-js/core.mjs";

Core.infect();

import fs from "fs";

import {
  UCFG,
  UCFGParser
} from "./ucfg.mjs";

/* ===--------------------------------------------------------------------------
// Check the command line arguments */
if (process.argv.length < 3) {
  console.log (`
Usage: ${process.argv[0]} ${process.argv[1]} <document>
`);

  process.exit (1);
}

/* Load the configuration file */
const path = process.argv[2];

if (!fs.existsSync (path)) {
  console.log (`Not found: ${path}`);
  process.exit (1);
}

const conf = fs.readFileSync (path, "utf8");

/* Parse the config */
const parser = new UCFGParser (conf);
const root = parser.parse();

/* Output the error code and the position in the input */
console.log ("Status:",   parser.err);
console.log ("Line:",     parser.line);
console.log ("Column:",   parser.col);
console.log ("Position:", parser.pos);

/* Format */
console.log ();
console.log (UCFG.stringify (root));

/* ===------------------------------- {U} --------------------------------=== */
