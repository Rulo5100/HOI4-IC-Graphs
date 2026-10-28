import re, json, sys

exe_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\tools\rakaly-0.8.19-x86_64-pc-windows-msvc\rakaly.exe"

with open(exe_path, "rb") as f:
    data = f.read()

text = data.decode("ascii", errors="replace")

# Find all "0xHEXID name" patterns
pattern = re.compile(r'0x([0-9a-f]{1,5})\s+([a-zA-Z_][a-zA-Z0-9_.:]*)')
all_matches = list(pattern.finditer(text))
print(f"Total matches: {len(all_matches)}")

# Group by position to find sections
# Each game has its own token section
sections = []
current_section = []
last_pos = -1000
for m in all_matches:
    if m.start() - last_pos > 500:
        if current_section:
            sections.append(current_section)
        current_section = []
    current_section.append(m)
    last_pos = m.end()
if current_section:
    sections.append(current_section)

print(f"Found {len(sections)} token sections")
for i, sec in enumerate(sections):
    ids = set()
    names = set()
    for m in sec:
        ids.add(int(m.group(1), 16))
        names.add(m.group(2))
    sample = [m.group(2) for m in sec[:5]]
    has_player_2a35 = any(int(m.group(1),16)==0x2a35 and m.group(2)=="player" for m in sec)
    hoi4_keywords = sum(1 for n in names if n in (
        "player_countries","ideology","difficulty","player_ai_prefs_command",
        "peace_score_ratio_transferred_to_players","doautosave","ai_focus_defense",
        "player_settings","war_with","thrust","naval_convoy_raid"
    ))
    print(f"  Section {i}: {len(sec)} tokens, offset 0x{sec[0].start():X}-0x{sec[-1].end():X}, "
          f"player@0x2a35={has_player_2a35}, hoi4_kw={hoi4_keywords}, "
          f"sample: {sample}")

# Find the HOI4 section (has 0x2a35=player and most HOI4 keywords)
hoi4_sections = []
for i, sec in enumerate(sections):
    has_player_2a35 = any(int(m.group(1),16)==0x2a35 and m.group(2)=="player" for m in sec)
    names = set(m.group(2) for m in sec)
    hoi4_keywords = sum(1 for n in names if n in (
        "player_countries","ideology","difficulty","doautosave",
        "ai_focus_defense","player_settings","thrust","naval_convoy_raid"
    ))
    if has_player_2a35 and hoi4_keywords >= 3:
        hoi4_sections.append((i, sec, hoi4_keywords))

if hoi4_sections:
    best = max(hoi4_sections, key=lambda x: (x[2], len(x[1])))
    print(f"\nBest HOI4 section: {best[0]} ({len(best[1])} tokens, {best[2]} keyword matches)")

    tokens = {}
    for m in best[1]:
        tid = int(m.group(1), 16)
        name = m.group(2)
        tokens[str(tid)] = name

    out_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.json"
    with open(out_path, "w") as f:
        json.dump(tokens, f, indent=1)
    print(f"Wrote {len(tokens)} tokens to {out_path}")

    # Also write a simple text format (one token per line, id=name)
    out_txt = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.txt"
    with open(out_txt, "w") as f:
        for tid in sorted(tokens.keys(), key=lambda x: int(x)):
            f.write(f"0x{int(tid):04x}\t{tokens[tid]}\n")
    print(f"Wrote text format to {out_txt}")
else:
    print("Could not identify HOI4 token section!")
