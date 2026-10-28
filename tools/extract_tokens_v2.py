import re, json

exe_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\tools\rakaly-0.8.19-x86_64-pc-windows-msvc\rakaly.exe"

with open(exe_path, "rb") as f:
    data = f.read()

text = data.decode("ascii", errors="replace")

# Find all "0xHEXID name" patterns
pattern = re.compile(r'0x([0-9a-f]{1,5})\s+([a-zA-Z_][a-zA-Z0-9_.:]*)')
all_matches = list(pattern.finditer(text))
print(f"Total matches: {len(all_matches)}")

# Find occurrences of "0x2a35 player" - the HOI4 token
hoi4_anchors = [m for m in all_matches
                if int(m.group(1),16) == 0x2a35 and m.group(2) == "player"]
print(f"Found {len(hoi4_anchors)} '0x2a35 player' anchors")
for a in hoi4_anchors:
    print(f"  At offset 0x{a.start():X}")

# For each anchor, collect the surrounding section
# Walk backwards and forwards from the anchor to find the section boundaries
for ai, anchor in enumerate(hoi4_anchors):
    # Find the index of this match in all_matches
    anchor_idx = None
    for i, m in enumerate(all_matches):
        if m.start() == anchor.start():
            anchor_idx = i
            break

    # Walk backwards to find section start (gap > 2000 bytes)
    start_idx = anchor_idx
    for i in range(anchor_idx - 1, -1, -1):
        if all_matches[i+1].start() - all_matches[i].end() > 2000:
            start_idx = i + 1
            break
        start_idx = i

    # Walk forwards to find section end
    end_idx = anchor_idx
    for i in range(anchor_idx + 1, len(all_matches)):
        if all_matches[i].start() - all_matches[i-1].end() > 2000:
            end_idx = i - 1
            break
        end_idx = i

    section = all_matches[start_idx:end_idx+1]
    tokens = {}
    for m in section:
        tid = int(m.group(1), 16)
        name = m.group(2)
        # Keep the first occurrence (closest to anchor)
        if tid not in tokens:
            tokens[tid] = name

    print(f"\nSection {ai}: {len(section)} matches, {len(tokens)} unique tokens")
    print(f"  Offset range: 0x{section[0].start():X} - 0x{section[-1].end():X}")

    # Verify HOI4 tokens
    verify = {0x2a35: "player", 0x3567: "player_countries"}
    for tid, expected in verify.items():
        actual = tokens.get(tid, "NOT FOUND")
        ok = "OK" if actual == expected else "MISMATCH"
        print(f"  0x{tid:04X}: {actual} ({ok})")

    # Check for HOI4-specific keys
    hoi4_keys = ["player_countries","ideology","difficulty","doautosave",
                 "ai_focus_defense","player_settings","thrust","naval_convoy_raid",
                 "peace_score_ratio_transferred_to_players","multiplayer_random_seed"]
    found = sum(1 for k in hoi4_keys if k in tokens.values())
    print(f"  HOI4 keywords found: {found}/{len(hoi4_keys)}")

    if found >= 5:
        out = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.json"
        out_data = {str(k): v for k, v in sorted(tokens.items())}
        with open(out, "w") as f:
            json.dump(out_data, f, indent=1)
        print(f"  SAVED {len(tokens)} HOI4 tokens to {out}")

        out_txt = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.txt"
        with open(out_txt, "w") as f:
            for tid in sorted(tokens.keys()):
                f.write(f"0x{tid:04x}\t{tokens[tid]}\n")
        print(f"  SAVED text format to {out_txt}")
