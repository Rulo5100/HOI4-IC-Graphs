#!/usr/bin/env python3
"""
Extract BFFU (MAIN BRANCH) equipment IC cost database from the mod's
common/units/equipment files, so the in-browser IC calculator can cost a save.

Outputs bffu_costs.json:
  base       : equipment_name -> build_cost_ic   (archetype inheritance resolved)
  moduleFlat : module_name    -> add_stats.build_cost_ic       (flat IC added)
  moduleMult : module_name    -> multiply_stats.build_cost_ic  (percentage, e.g. -0.1)
  upgrade    : upgrade_name    -> add_stats.build_cost_ic       (IC per level)

Formula (HOI4 wiki):
  unit_IC = (base + sum(flat modules) + sum(level*upgrade)) * (1 + sum(mult modules))
"""
import json, os, sys

# Usage: extract_bffu_costs.py [out.json] [mod_dir ...]
#   Mod dirs are given in load order (later ones override earlier ones, file by file,
#   like HOI4 does). Default: BFFU (MAIN BRANCH) -> bffu_costs.json.
# Oak:  extract_bffu_costs.py oak_costs.json "<HOI4 install dir>" "<workshop>/2566601386"
#       (vanilla first, because Oak does not replace common/units/equipment)
DEFAULT_MOD = r"C:\Users\Roberts (ME)\Documents\Paradox Interactive\Hearts of Iron IV\mod\MAIN BRANCH"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "bffu_costs.json")
MODS = sys.argv[2:] or [DEFAULT_MOD]
EQS = [os.path.join(m, "common", "units", "equipment") for m in MODS]

# ---------- minimal Clausewitz tokenizer / parser ----------
def tokenize(text):
    i, n, toks = 0, len(text), []
    while i < n:
        c = text[i]
        if c == '#':
            while i < n and text[i] != '\n': i += 1
        elif c in ' \t\r\n': i += 1
        elif c in '{}=': toks.append(c); i += 1
        elif c == '"':
            j = i + 1
            while j < n and text[j] != '"': j += 1
            toks.append(('str', text[i+1:j])); i = j + 1
        else:
            j = i
            while j < n and text[j] not in ' \t\r\n{}=#"': j += 1
            toks.append(('tok', text[i:j])); i = j
    return toks

def parse_block(toks, i):
    """Return (children, next_index). children = list of (key, value)."""
    children = []
    while i < len(toks):
        t = toks[i]
        if t == '}': return children, i + 1
        key = t[1] if isinstance(t, tuple) else t
        i += 1
        if i < len(toks) and toks[i] == '=':
            i += 1
            if i < len(toks) and toks[i] == '{':
                blk, i = parse_block(toks, i + 1)
                children.append((key, blk))
            else:
                v = toks[i]; children.append((key, v[1] if isinstance(v, tuple) else v)); i += 1
        elif i < len(toks) and toks[i] == '{':
            blk, i = parse_block(toks, i + 1)
            children.append((key, blk))
        else:
            children.append((key, None))
    return children, i

def parse(text):
    return parse_block(tokenize(text), 0)[0]

def scalar(block, key):
    for k, v in block:
        if k == key and not isinstance(v, list): return v
    return None

def child(block, key):
    for k, v in block:
        if k == key and isinstance(v, list): return v
    return None

def is_block(v): return isinstance(v, list)
def to_f(v):
    try: return float(v)
    except (TypeError, ValueError): return None

# ---------- walk every named block recursively ----------
def walk(block, cb, depth=0):
    for k, v in block:
        if is_block(v):
            cb(k, v, depth)
            walk(v, cb, depth + 1)

base_raw = {}      # name -> (build_cost_ic or None, archetype or None)
moduleFlat, moduleMult, upgrade = {}, {}, {}

def layered(sub):
    """(layer, path) for every .txt in <equipment>/<sub>; a later layer's same-named file replaces earlier ones."""
    files = {}
    for layer, eq in enumerate(EQS):
        d = os.path.join(eq, sub) if sub else eq
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                p = os.path.join(d, f)
                if f.endswith('.txt') and os.path.isfile(p): files[f] = (layer, p)
    return [files[f] for f in sorted(files)]

def list_files(sub): return layered(sub)
def equipment_files(): return layered('')

# --- base equipment costs ---
base_layer = {}
for layer, path in equipment_files():
    txt = open(path, encoding='utf-8-sig', errors='ignore').read()
    tree = parse(txt)
    def cb(name, blk, depth, layer=layer):
        bc = to_f(scalar(blk, 'build_cost_ic'))
        arch = scalar(blk, 'archetype')
        is_arch = scalar(blk, 'is_archetype')
        # an equipment definition has a build cost, an archetype, or is an archetype
        if bc is not None or arch is not None or is_arch is not None:
            if name not in base_raw or base_raw[name] == (None, None) or layer > base_layer.get(name, 0):
                base_raw[name] = (bc, arch); base_layer[name] = layer
    walk(tree, cb)

# resolve archetype inheritance
def resolve(name, seen=None):
    seen = seen or set()
    if name in seen: return None
    seen.add(name)
    bc, arch = base_raw.get(name, (None, None))
    if bc is not None: return bc
    if arch and arch in base_raw: return resolve(arch, seen)
    return None

base = {}
for name in base_raw:
    r = resolve(name)
    if r is not None: base[name] = round(r, 4)

# --- module flat / percentage costs ---
for _layer, path in list_files('modules'):
    tree = parse(open(path, encoding='utf-8-sig', errors='ignore').read())
    def cb(name, blk, depth):
        # a module block has an abbreviation or category, plus stat blocks
        if scalar(blk, 'abbreviation') is None and scalar(blk, 'category') is None:
            return
        addb = child(blk, 'add_stats'); mulb = child(blk, 'multiply_stats')
        flat = to_f(scalar(addb, 'build_cost_ic')) if addb else None
        mult = to_f(scalar(mulb, 'build_cost_ic')) if mulb else None
        if flat: moduleFlat[name] = round(flat, 4)
        if mult: moduleMult[name] = round(mult, 4)
    walk(tree, cb)

# --- upgrade per-level costs ---
for _layer, path in list_files('upgrades'):
    tree = parse(open(path, encoding='utf-8-sig', errors='ignore').read())
    def cb(name, blk, depth):
        if scalar(blk, 'max_level') is None: return
        addb = child(blk, 'add_stats')
        per = to_f(scalar(addb, 'build_cost_ic')) if addb else None
        if per is None: per = to_f(scalar(blk, 'build_cost_ic'))   # Oak/vanilla style: stat sits directly in the upgrade
        if per: upgrade[name] = round(per, 4)
    walk(tree, cb)

db = {"base": base, "moduleFlat": moduleFlat, "moduleMult": moduleMult, "upgrade": upgrade}
json.dump(db, open(OUT, 'w'), indent=0)
print("base:", len(base), "moduleFlat:", len(moduleFlat),
      "moduleMult:", len(moduleMult), "upgrade:", len(upgrade))
print("samples:")
for k in ("infantry_equipment_1", "medium_tank_chassis_2", "small_plane_airframe_1"):
    print("  base", k, "=", base.get(k))
for k in ("tank_gas_turbine_engine", "tank_riveted_armor", "tank_petrol_electric_engine"):
    print("  mod ", k, "flat=", moduleFlat.get(k), "mult=", moduleMult.get(k))
for k in list(upgrade)[:5]:
    print("  upg ", k, "=", upgrade.get(k))
print("written:", OUT)
