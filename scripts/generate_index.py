import os, json, re, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
POSTS = BASE/"posts"
OUT = POSTS/"index.json"

FM_RE = re.compile(r"^---\s*\n([\s\S]*?)\n---\s*\n", re.M)
KV_RE = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")


def parse_front_matter(text: str):
    meta = {}
    m = FM_RE.match(text)
    if not m:
        return meta, text
    fm = m.group(1)
    for line in fm.splitlines():
        kvm = KV_RE.match(line.strip())
        if not kvm:
            continue
        k, v = kvm.group(1), kvm.group(2).strip()
        if v.startswith("[") and v.endswith("]"):
            arr = [s.strip().strip("'\"") for s in v[1:-1].split(',') if s.strip()]
            meta[k] = arr
        else:
            meta[k] = v
    body = text[m.end():]
    return meta, body


def first_heading(body: str):
    m = re.search(r"^#\s+(.+)$", body, re.M)
    return m.group(1).strip() if m else None


def first_paragraph(body: str):
    blocks = re.split(r"\n\n+", body.strip())
    for blk in blocks:
        t = blk.strip()
        if not t or t.startswith('#'):
            continue
        # strip markdown tokens roughly
        t = re.sub(r"```[\s\S]*?```", " ", t)
        t = re.sub(r"!\[[^\]]*\]\([^\)]*\)", " ", t)
        t = re.sub(r"\[[^\]]*\]\([^\)]*\)", " ", t)
        t = re.sub(r"[#>*_`~]", " ", t)
        t = re.sub(r"\s+", " ", t)
        return t[:140]
    return ""


def file_date(path: Path):
    try:
        ts = path.stat().st_mtime
        dt = datetime.datetime.fromtimestamp(ts)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return datetime.date.today().strftime('%Y-%m-%d')


def main():
    posts = []
    for p in sorted(POSTS.glob('*.md')):
        if p.name.lower() == 'readme.md':
            continue
        slug = p.stem
        text = p.read_text(encoding='utf-8', errors='ignore')
        meta, body = parse_front_matter(text)
        title = meta.get('title') or first_heading(body) or slug
        date = meta.get('date') or file_date(p)
        excerpt = meta.get('excerpt') or first_paragraph(body)
        tags = meta.get('tags') or []
        posts.append({
            'title': title,
            'slug': slug,
            'date': date,
            'excerpt': excerpt,
            'tags': tags,
        })
    # sort by date desc
    def to_dt(s):
        try:
            return datetime.datetime.fromisoformat(s)
        except Exception:
            try:
                return datetime.datetime.strptime(s, '%Y-%m-%d')
            except Exception:
                return datetime.datetime.min
    posts.sort(key=lambda x: to_dt(x['date']), reverse=True)
    OUT.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {len(posts)} posts to {OUT}')


if __name__ == '__main__':
    main()