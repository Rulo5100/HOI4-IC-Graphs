import json, struct

tokens_path = r"C:\Users\Roberts (ME)\Downloads\HOI4-IC-Graphs\hoi4_tokens.json"
save_path = r"C:\Users\Roberts (ME)\Documents\Paradox Interactive\Hearts of Iron IV\save games\autosave.hoi4"

with open(tokens_path) as f:
    tokens = json.load(f)

with open(save_path, "rb") as f:
    data = f.read(4000)

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
def decode_date(val):
    hour = val % 24
    val //= 24
    ordinal = val % 365
    year = (val // 365) - 5000
    month = 1
    day = ordinal
    for m, d in enumerate(MONTH_DAYS):
        if day < d:
            month = m + 1
            day += 1
            break
        day -= d
    else:
        month = 12
        day += 1
    return f"{year}.{month}.{day}.{hour+1}"

# Type codes
EQUAL = 0x0001; OPEN = 0x0003; CLOSE = 0x0004
I32 = 0x000C; F32 = 0x000D; BOOL = 0x000E
QUOTED = 0x000F; U32 = 0x0014; UNQUOTED = 0x0017
F64 = 0x0167; RGB = 0x0243; U64 = 0x029C; I64 = 0x0317

TYPE_TOKENS = {EQUAL, OPEN, CLOSE, I32, F32, BOOL, QUOTED, U32, UNQUOTED, F64, RGB, U64, I64}

pos = 7  # skip "HOI4bin"
indent = 0
lines = 0
last_was_key = False

while pos < len(data) - 2 and lines < 80:
    token = struct.unpack_from('<H', data, pos)[0]
    pos += 2

    if token == EQUAL:
        print("=", end="")
        continue
    elif token == OPEN:
        print("{")
        indent += 1
        lines += 1
        continue
    elif token == CLOSE:
        indent = max(0, indent - 1)
        print("\t" * indent + "}")
        lines += 1
        continue
    elif token == I32:
        val = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        # Could be a date - check if it decodes to reasonable year
        date_str = decode_date(val)
        try:
            year = int(date_str.split('.')[0])
            if 1 <= year <= 9999:
                print(f"{date_str}")
            else:
                print(f"{val}")
        except:
            print(f"{val}")
        lines += 1
        continue
    elif token == F32:
        val = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        print(f"{val / 1000.0:.6f}".rstrip('0').rstrip('.'))
        lines += 1
        continue
    elif token == BOOL:
        val = data[pos]
        pos += 1
        print("yes" if val else "no")
        lines += 1
        continue
    elif token == QUOTED:
        slen = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        s = data[pos:pos+slen].decode('windows-1252', errors='replace')
        pos += slen
        print(f'"{s}"')
        lines += 1
        continue
    elif token == U32:
        val = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        print(f"{val}")
        lines += 1
        continue
    elif token == UNQUOTED:
        slen = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        s = data[pos:pos+slen].decode('windows-1252', errors='replace')
        pos += slen
        print(f"{s}")
        lines += 1
        continue
    elif token == F64:
        raw = struct.unpack_from('<q', data, pos)[0]
        pos += 8
        print(f"{raw / 100000.0}")
        lines += 1
        continue
    elif token == U64:
        val = struct.unpack_from('<Q', data, pos)[0]
        pos += 8
        print(f"{val}")
        lines += 1
        continue
    elif token == I64:
        val = struct.unpack_from('<q', data, pos)[0]
        pos += 8
        print(f"{val}")
        lines += 1
        continue
    else:
        # Key token
        name = tokens.get(str(token), f"0x{token:04x}")
        print("\t" * indent + f"{name}", end="")
        continue
