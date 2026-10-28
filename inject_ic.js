// Inlines ic_calc_core.js + bffu_costs.json into bar_charts.html (idempotent).
const fs = require("fs");
let html = fs.readFileSync("bar_charts.html", "utf8");
const core = fs.readFileSync("ic_calc_core.js", "utf8");
const db = fs.readFileSync("bffu_costs.json", "utf8");
const oak = fs.readFileSync("oak_costs.json", "utf8");   // Hearts of Oak 2 (vanilla + Oak layered)
const START = "<!--IC_CORE_START-->", END = "<!--IC_CORE_END-->";
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const block = START + "\n" +
  "<script>window.BFFU_COSTS=" + db + ";window.OAK_COSTS=" + oak + ";</scr" + "ipt>\n" +
  "<script>\n" + core + "\n</scr" + "ipt>\n" +
  // non-executing copy of the core source, read as text to build the Web Worker blob
  '<script type="text/plain" id="icCoreSrc">\n' + core + "\n</scr" + "ipt>\n" +
  END;

const re = new RegExp(esc(START) + "[\\s\\S]*?" + esc(END));
if (re.test(html)) html = html.replace(re, block);   // replace previous injection
else {
  const anchor = html.indexOf('<script>\n"use strict";');
  if (anchor < 0) { console.error("ANCHOR NOT FOUND"); process.exit(1); }
  html = html.slice(0, anchor) + block + "\n" + html.slice(anchor);
}
fs.writeFileSync("bar_charts.html", html);
console.log("injected. core:", core.length, "db:", db.length, "html now:", html.length);
