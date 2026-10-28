import json, struct

tokens_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.json"
save_path = r"C:\Users\Roberts (ME)\Documents\Paradox Interactive\Hearts of Iron IV\save games\autosave.hoi4"

with open(tokens_path) as f:
    tokens = json.load(f)

with open(save_path, "rb") as f:
    data = f.read(2000)

# Skip "HOI4bin" header (7 bytes)
pos = 7
count = 0
indent = 0

EQUALS = 0x0001
OPEN = 0x0003
CLOSE = 0x0004

while pos < len(data) - 2 and count < 100:
    token = struct.unpack_from('<H', data, pos)[0]
    pos += 2

    if token == EQUALS:
        print("  " * indent + "= ", end="")
        continue
    elif token == OPEN:
        print("{")
        indent += 1
        count += 1
        continue
    elif token == CLOSE:
        indent = max(0, indent - 1)
        print("  " * indent + "}")
        count += 1
        continue
    elif token == 0x000C:  # bool or date?
        val = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        print(f"[0x000C: {val} / 0x{val:08X}]")
        count += 1
        continue
    elif token == 0x000D:  # u32
        val = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        print(f"[u32: {val}]")
        count += 1
        continue
    elif token == 0x000E:  # i32
        val = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        print(f"[i32: {val}]")
        count += 1
        continue
    elif token == 0x000F:  # unquoted string
        slen = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        s = data[pos:pos+slen].decode('windows-1252', errors='replace')
        pos += slen
        print(f"{s}")
        count += 1
        continue
    elif token == 0x0014:  # f32 (Q49.15 fixed point, divide by 1000)
        val = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        print(f"[f32: {val/1000.0}]")
        count += 1
        continue
    elif token == 0x0015:  # f64
        val = struct.unpack_from('<q', data, pos)[0]
        pos += 8
        print(f"[f64: {val}]")
        count += 1
        continue
    elif token == 0x0017:  # quoted string
        slen = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        s = data[pos:pos+slen].decode('windows-1252', errors='replace')
        pos += slen
        print(f'"{s}"')
        count += 1
        continue
    else:
        # It's a key token
        name = tokens.get(str(token), f"__unknown_0x{token:04x}")
        print("  " * indent + f"{name}", end="")
        count += 1
        continue
