#!/usr/bin/env python3
"""合并 data/ch*.js -> data/ch.js，并做基础完整性检查。"""
import re, sys, json, pathlib

ROOT = pathlib.Path(__file__).parent
DATA = ROOT / "data"

def main():
    files = sorted(p for p in DATA.glob("ch*.js") if re.fullmatch(r"ch\d{2}\.js", p.name))
    if not files:
        print("no chapter files found"); sys.exit(1)
    parts, ids = [], []
    for f in files:
        txt = f.read_text(encoding="utf-8")
        m = re.search(r'id\s*:\s*"(ch\d+|prologue)"', txt)
        if not m:
            print(f"[warn] no id in {f.name}")
        else:
            ids.append(m.group(1))
        parts.append(f"// ===== {f.name} =====\n" + txt)
    (DATA / "ch.js").write_text("\n\n".join(parts), encoding="utf-8")
    dup = [i for i in set(ids) if ids.count(i) > 1]
    print(f"merged {len(files)} files -> data/ch.js")
    print("chapter ids:", ",".join(ids))
    if dup: print("[warn] duplicate ids:", dup)
    expected = [f"ch{i:02d}" for i in range(1, 43)]
    missing = [c for c in expected if c not in ids]
    if missing: print("[warn] missing chapters:", missing)

if __name__ == "__main__":
    main()
