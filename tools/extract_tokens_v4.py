import re, json

exe_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\tools\rakaly-0.8.19-x86_64-pc-windows-msvc\rakaly.exe"

with open(exe_path, "rb") as f:
    data = f.read()

# HOI4 section: 0x40FF00 to 0x4DE000
hoi4_start = 0x40FF00
hoi4_end = 0x4DE000
section = data[hoi4_start:hoi4_end].decode("ascii", errors="replace")

pattern = re.compile(r'0x([0-9a-f]{1,5})\s+([a-zA-Z_][a-zA-Z0-9_.:]*)')
matches = list(pattern.finditer(section))

tokens = {}
dupes = 0
for m in matches:
    tid = int(m.group(1), 16)
    name = m.group(2)
    if tid in tokens and tokens[tid] != name:
        dupes += 1
    tokens[tid] = name

print(f"Extracted {len(tokens)} unique tokens ({dupes} overwritten duplicates)")
print(f"ID range: 0x{min(tokens.keys()):04X} - 0x{max(tokens.keys()):04X}")

# Verify
checks = {
    0x2a35: "player",
    0x2a20: "autosave",
    0x2a38: "doautosave",
    0x2a3b: "thrust",
}
print("\nVerification:")
for tid, expected in checks.items():
    actual = tokens.get(tid, "NOT FOUND")
    ok = "OK" if actual == expected else f"MISMATCH (got {actual})"
    print(f"  0x{tid:04X}: expected '{expected}' -> {ok}")

# Check for HOI4-specific tokens
hoi4_names = ["player_countries","ideology","difficulty","doautosave",
              "ai_focus_defense","player_settings","naval_convoy_raid",
              "light_tank_chassis","medium_tank_chassis","infantry_equipment",
              "air_wing","task_force","divisions","stockpiles"]
found = [n for n in hoi4_names if n in tokens.values()]
print(f"\nHOI4 keywords found: {len(found)}/{len(hoi4_names)}: {found}")

# Save
out = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.json"
out_data = {}
for tid in sorted(tokens.keys()):
    out_data[str(tid)] = tokens[tid]
with open(out, "w") as f:
    json.dump(out_data, f)
print(f"\nSaved {len(tokens)} tokens to {out}")
print(f"JSON size: {len(json.dumps(out_data)):,} bytes")
