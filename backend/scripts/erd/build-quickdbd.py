"""Builds docs/erd-quickdbd.txt (paste into https://app.quickdatabasediagrams.com) from the live schema.

Inputs are tab-separated exports of the local database, see docs/erd.md for how to refresh them:
  cols.tsv   columns.sql output with an extra column_default column after is_nullable
  fks.tsv    fks.sql output
  enums.tsv  enum type name + comma-separated labels
Usage: python build-quickdbd.py <dir with the .tsv files> <output file>
"""
import re
import sys
from collections import OrderedDict

src, out = sys.argv[1], sys.argv[2]


def rows(name):
    with open(f"{src}/{name}", encoding="utf-8") as f:
        return [line.rstrip("\n").split("\t") for line in f if line.strip()]


# Core tables first so the diagram reads top-down; anything new is appended alphabetically.
ORDER = [
    "users", "refresh_tokens", "workshops", "services", "mechanics", "workshop_quotas", "workshop_holidays",
    "workshop_photos", "vehicles", "orders", "booking_details", "emergency_details", "emergency_routing_attempts",
    "transactions", "reviews", "notifications", "order_status_history", "audit_logs",
]

TYPE = {"int8": "bigint", "int4": "int", "int2": "smallint", "bool": "boolean", "float8": "double", "timestamptz": "timestamptz"}


def col_type(data_type, udt):
    if data_type == "ARRAY":
        return f"{udt.lstrip('_')}[]"
    if udt == "geography":
        return "geography(Point,4326)"
    return TYPE.get(udt, udt)


def clean_default(d):
    if not d or d.startswith("nextval("):
        return None  # serial / identity: implied by the type
    d = re.sub(r"::[a-z_ ]+(\[\])?", "", d).strip()  # drop casts like ::workshop_status
    return d if " " not in d else None  # QuickDBD defaults cannot contain spaces


tables = OrderedDict()
for t, c, data_type, udt, nullable, default, pk, uk in rows("cols.tsv"):
    tables.setdefault(t, []).append((c, col_type(data_type, udt), nullable == "YES", clean_default(default), pk == "PK", uk == "UK"))

fks = {(t, c): (rt, rc) for t, c, rt, rc, _rule in rows("fks.tsv")}
enums = rows("enums.tsv")

ordered = [t for t in ORDER if t in tables] + sorted(t for t in tables if t not in ORDER)

lines = [
    "# BengkelGo database (PostgreSQL + PostGIS), generated from migrations 001-010",
    "# Paste into https://app.quickdatabasediagrams.com",
    "#",
    "# Enum types:",
]
lines += [f"#   {name}: {labels}" for name, labels in enums]
lines.append("")

for t in ordered:
    lines.append(t)
    lines.append("-")
    for c, typ, nullable, default, pk, uk in tables[t]:
        parts = [c, typ]
        if pk:
            parts.append("PK")
        if (t, c) in fks:
            rt, rc = fks[(t, c)]
            parts.append(f"FK >- {rt}.{rc}")
        if nullable:
            parts.append("NULL")
        if uk and not pk:
            parts.append("UNIQUE")
        if default is not None:
            parts.append(f"default={default}")
        lines.append(" ".join(parts))
    lines.append("")

with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines))
print(f"{len(ordered)} tables, {sum(len(v) for v in tables.values())} columns, {len(fks)} relationships -> {out}")
