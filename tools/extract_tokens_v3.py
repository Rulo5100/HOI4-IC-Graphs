import re, json

exe_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\tools\rakaly-0.8.19-x86_64-pc-windows-msvc\rakaly.exe"

with open(exe_path, "rb") as f:
    data = f.read()

text = data.decode("ascii", errors="replace")

pattern = re.compile(r'0x([0-9a-f]{1,5})\s+([a-zA-Z_][a-zA-Z0-9_.:]*)')
all_matches = list(pattern.finditer(text))

# The HOI4 anchor "0x2a35 player" is at offset 0x41765F
# Find gaps near this area to identify section boundaries
anchor_offset = 0x41765F

# Find all gaps > 200 bytes
gaps = []
for i in range(1, len(all_matches)):
    gap = all_matches[i].start() - all_matches[i-1].end()
    if gap > 200:
        gaps.append((all_matches[i-1].end(), all_matches[i].start(), gap, i))

# Show gaps near the anchor
print("Gaps near HOI4 anchor (0x41765F):")
for end, start, gap, idx in gaps:
    if abs(start - anchor_offset) < 0x100000 or abs(end - anchor_offset) < 0x100000:
        print(f"  Gap at 0x{end:X}-0x{start:X} ({gap} bytes) [match idx {idx}]")

# The HOI4 section likely starts after a gap before 0x41xxxx and ends at a gap after
# Let me find section boundaries based on larger gaps
print("\nAll significant gaps (>500 bytes):")
for end, start, gap, idx in gaps:
    if gap > 500:
        # Show what tokens are on either side
        before = all_matches[idx-1].group(2) if idx > 0 else "START"
        after = all_matches[idx].group(2) if idx < len(all_matches) else "END"
        print(f"  0x{end:X}-0x{start:X} ({gap:,} bytes) | before: {before} | after: {after}")
