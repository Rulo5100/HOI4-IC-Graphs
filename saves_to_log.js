#!/usr/bin/env node
/*
 * saves_to_log.js - turn a set of HOI4 saves (for example the monthly autosaves) into an IC log
 * in the same format the data-collection DLL writes (output_YYYY-MM-DD_HH-MM-SS.txt), so the
 * result opens in gui.exe and bar_charts.html like any other log.
 *
 *   node saves_to_log.js <folder | save.hoi4 ...> [--out file.txt] [--all] [--daily] [--civ omit|zero|levels]
 *
 *   --out    output file (default: output_from_saves_<first>_<last>.txt in the current folder)
 *   --all    use every save found (default: only saves dated the 1st of a month, i.e. monthly autosaves)

 *   --daily  also write one row per day between the saves (straight-line interpolation), like the DLL's daily rows.
 *            Use this for tools that add up daily values (the Line Charts tab); leave it off for a plain monthly file.
 *   --civ    what to write for the CIV rows (default omit, see below)
 *
 * Per country and save it writes:
 *   MIL = sum of "speed" over every military and railway-gun production line (matches the DLL)
 *   NAV = sum of "speed" over every naval production and ship refit line (matches the DLL)
 *   CIV = not reconstructable from a save (the DLL's number does not follow the factory counts), so it is
 *         left out by default. "zero" writes 0, "levels" writes civilian factory levels x 4.5 (NOT the same
 *         scale as the DLL, never mix it with DLL logs).
 *
 * One row set per save, so a monthly set gives one data point per month. Plaintext and binary saves are both
 * read (binary through hoi4_bin2txt.js + hoi4_tokens.json). Zipped ironman saves are not supported.
 */
"use strict";
const fs = require("fs"), path = require("path");

// The DLL logs a fixed set of countries (not every tag in the save), in the save's own order.
const LOGGED = new Set(("GER ENG SOV SWE FRA LUX BEL HOL POL AUS LAT SPR SPN ITA ROM YUG SWI TUR GRE ALB NOR DEN BUL POR FIN IRE HUN " +
  "AST CAN CHI ETH IRQ JAP NZL PER SAF SIA VEN USA MON TAN PAR SLO RAJ PRC MAN DNZ EFR").split(" "));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function loadText(file) {
  const buf = fs.readFileSync(file);
  if (buf.length > 8 && buf.toString("latin1", 0, 7) === "HOI4bin") {
    const conv = require("./hoi4_bin2txt.js");
    const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, "hoi4_tokens.json"), "utf8"));
    return conv.meltHoi4(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), tokens);
  }
  if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error("zipped (ironman) save, not supported");
  return buf.toString("latin1");        // keys are ASCII; latin1 is the fastest decode
}

function isTagChar(c) { return (c >= 65 && c <= 90) || (c >= 48 && c <= 57); }

// -> {date:{y,m,d,h}, countries:[{tag, mil, nav, civ, hasLines, states}]} in save order
function readSave(file) {
  const text = loadText(file);
  const dm = /\bdate="(\d+)\.(\d+)\.(\d+)\.(\d+)"/.exec(text.slice(0, 20000));
  if (!dm) throw new Error("no date found");
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i] !== "countries={" && lines[i] !== "countries={\r") i++;
  if (i >= lines.length) throw new Error("no countries block");
  const countries = []; let cur = null, mode = 0;   // mode 1 = military_lines, 2 = naval_lines
  for (i++; i < lines.length; i++) {
    const ln = lines[i];
    const c0 = ln.charCodeAt(0);
    if (c0 !== 9) {                                                    // column 0: the block ended at the next top-level key
      if (c0 >= 97 && c0 <= 122 && /^[a-z_]+=\{/.test(ln)) break;
      continue;
    }
    // country header: <tab>TAG={
    if (ln.charCodeAt(4) === 61 && ln.charCodeAt(5) === 123 && ln.charCodeAt(1) !== 9 &&
        isTagChar(ln.charCodeAt(1)) && isTagChar(ln.charCodeAt(2)) && isTagChar(ln.charCodeAt(3))) {
      cur = { tag: ln.substr(1, 3), mil: 0, nav: 0, civ: 0, hasLines: false };
      countries.push(cur); mode = 0; continue;
    }
    if (!cur) continue;
    if (ln.charCodeAt(2) === 9 && ln.charCodeAt(3) !== 9) {            // exactly three tabs: a child of production={}
      if (ln.startsWith("\t\t\tmilitary_lines={") || ln.startsWith("\t\t\trailway_gun_lines={")) { mode = 1; cur.hasLines = true; }
      else if (ln.startsWith("\t\t\tnaval_lines={") || ln.startsWith("\t\t\tship_refit_lines={")) { mode = 2; cur.hasLines = true; }
      else mode = 0;
    } else if (mode && ln.charCodeAt(3) === 9 && ln.charCodeAt(4) !== 9 && ln.startsWith("\t\t\t\tspeed=")) {
      const v = parseFloat(ln.slice(10));
      if (mode === 1) cur.mil += v; else cur.nav += v;
    }
  }
  return { date: { y: +dm[1], m: +dm[2], d: +dm[3], h: +dm[4] }, countries };
}

// civilian factory levels per owner from the states block (only used for --civ levels)
function civLevels(file) {
  const lines = loadText(file).split("\n"), out = {};
  let i = 0; while (i < lines.length && lines[i].replace("\r", "") !== "states={") i++;
  let owner = null, lvl = 0, inIC = false;
  for (i++; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.charCodeAt(0) !== 9) { if (ln.replace("\r", "") === "}") break; continue; }
    if (ln.charCodeAt(2) !== 9 && ln.charCodeAt(1) !== 9 && /^\t\d+=\{/.test(ln)) { owner = null; lvl = 0; }
    else if (ln.startsWith("\t\t\tindustrial_complex={")) inIC = true;
    else if (inIC && ln.startsWith("\t\t\t\tlevel=")) { lvl += parseInt(ln.slice(7), 10); inIC = false; }
    else if (ln.startsWith("\t\towner=\"")) { owner = ln.substr(9, 3); out[owner] = (out[owner] || 0) + lvl; }
  }
  return out;
}

const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];      // HOI4 has no leap days
function ordinal(d) { let n = d.y * 365 + d.d; for (let i = 0; i < d.m - 1; i++) n += ML[i]; return n; }
function fromOrdinal(n) {
  let y = Math.floor((n - 1) / 365), r = n - y * 365, m = 0;
  while (r > ML[m]) { r -= ML[m]; m++; }
  return { y, m: m + 1, d: r };
}
function fmtDate(d) { return " " + d.h + ":00, " + d.d + " " + MONTHS[d.m - 1] + ", " + d.y; }

function main() {
  const args = process.argv.slice(2);
  let out = null, all = false, daily = false, civ = "omit"; const inputs = [];
  for (let k = 0; k < args.length; k++) {
    if (args[k] === "--out") out = args[++k];
    else if (args[k] === "--all") all = true;
    else if (args[k] === "--daily") daily = true;
    else if (args[k] === "--civ") civ = args[++k];
    else inputs.push(args[k]);
  }
  if (!inputs.length) { console.error("usage: node saves_to_log.js <folder | saves...> [--out file] [--all] [--daily] [--civ omit|zero|levels]"); process.exit(1); }
  if (["omit", "zero", "levels"].indexOf(civ) < 0) { console.error("--civ must be omit, zero or levels"); process.exit(1); }

  let files = [];
  inputs.forEach(p => {
    if (fs.statSync(p).isDirectory()) fs.readdirSync(p).filter(f => /\.hoi4$/i.test(f)).forEach(f => files.push(path.join(p, f)));
    else files.push(p);
  });
  const rows = [];                                           // {date, key, file, countries}
  files.forEach((f, n) => {
    try {
      process.stdout.write("[" + (n + 1) + "/" + files.length + "] " + path.basename(f) + " ... ");
      const t0 = Date.now(), s = readSave(f);
      if (!all && s.date.d !== 1) { console.log("skipped (" + s.date.d + " " + MONTHS[s.date.m - 1] + " " + s.date.y + ", not the 1st)"); return; }
      if (civ === "levels") { const lv = civLevels(f); s.countries.forEach(c => { c.civ = (lv[c.tag] || 0) * 4.5; }); }
      rows.push({ date: s.date, key: ((s.date.y * 100 + s.date.m) * 100 + s.date.d) * 100 + s.date.h, file: f, mtime: fs.statSync(f).mtimeMs, countries: s.countries });
      console.log(s.date.d + " " + MONTHS[s.date.m - 1] + " " + s.date.y + ", " + s.countries.length + " countries, " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
    } catch (e) { console.log("FAILED: " + e.message); }
  });
  if (!rows.length) { console.error("nothing to write"); process.exit(1); }

  // one save per calendar day: the earliest hour wins (the DLL samples at 1:00), then the newest file
  const byKey = new Map();
  rows.forEach(r => {
    const day = Math.floor(r.key / 100), o = byKey.get(day);
    if (!o || r.date.h < o.date.h || (r.date.h === o.date.h && r.mtime > o.mtime)) byKey.set(day, r);
  });
  const sorted = [...byKey.values()].sort((a, b) => a.key - b.key);

  const lines = [];
  const emit = (stamp, c, mil, nav, cv) => {
    const row = (type, v) => lines.push(stamp + " " + c.tag + " " + type + " 1 " + v.toFixed(6) + "     ");
    row("MIL", mil); row("NAV", nav);
    if (civ === "zero") row("CIV", 0); else if (civ === "levels") row("CIV", cv);
  };
  const logged = r => r.countries.filter(c => LOGGED.has(c.tag) && !(c.tag === "EFR" && !c.hasLines));   // EFR only once it exists
  let prev = null;
  sorted.forEach(r => {
    // --daily: fill the days between two saves by straight-line interpolation (a monthly set otherwise has 1 row per month,
    // while tools that add up daily rows, like the line charts, expect one row per day like the DLL writes)
    if (daily && prev) {
      const pm = new Map(prev.countries.map(c => [c.tag, c])), n = ordinal(r.date) - ordinal(prev.date);
      for (let k = 1; k < n; k++) {
        const t = k / n, d = fromOrdinal(ordinal(prev.date) + k), stamp = fmtDate({ y: d.y, m: d.m, d: d.d, h: prev.date.h });
        logged(r).forEach(c => {
          const p = pm.get(c.tag) || { mil: 0, nav: 0, civ: 0 };
          emit(stamp, c, p.mil + (c.mil - p.mil) * t, p.nav + (c.nav - p.nav) * t, p.civ + (c.civ - p.civ) * t);
        });
      }
    }
    const stamp = fmtDate(r.date);
    logged(r).forEach(c => emit(stamp, c, c.mil, c.nav, c.civ));
    prev = r;
  });
  const a = sorted[0].date, b = sorted[sorted.length - 1].date;
  if (!out) out = "output_from_saves_" + a.y + "-" + String(a.m).padStart(2, "0") + "_to_" + b.y + "-" + String(b.m).padStart(2, "0") + ".txt";
  fs.writeFileSync(out, lines.join("\r\n") + "\r\n");
  console.log("\nwrote " + out + ": " + sorted.length + " dates (" + fmtDate(a).trim() + " to " + fmtDate(b).trim() + "), " + lines.length + " lines");
}
main();
