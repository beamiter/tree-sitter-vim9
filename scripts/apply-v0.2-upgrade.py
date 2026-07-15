#!/usr/bin/env python3
"""Temporary bootstrap for the repository-wide Vim9 parser v0.2 upgrade."""

from __future__ import annotations

import base64
import gzip
import io
from pathlib import Path
import shutil
import tarfile

OBSOLETE = [
    "bindings/c/tree-sitter-vim.pc.in",
    "bindings/python/tree_sitter_vim/binding.c",
    "bindings/swift/TreeSitterVim/vim.h",
    "bindings/swift/TreeSitterVimTests/TreeSitterVimTests.swift",
    "keywords.js",
    "src/keywords.h",
]


def main() -> None:
    root = Path.cwd().resolve()
    payload_dir = root / "scripts" / ".upgrade-payload"
    payload = "".join(
        part.read_text(encoding="ascii")
        for part in sorted(payload_dir.glob("part-*.txt"))
    )
    archive = tarfile.open(
        fileobj=io.BytesIO(base64.b64decode(payload)), mode="r:gz"
    )
    for member in archive.getmembers():
        destination = (root / member.name).resolve()
        if root not in destination.parents and destination != root:
            raise RuntimeError(f"unsafe archive path: {member.name}")
    archive.extractall(root)

    grammar_payload = (payload_dir / "grammar.txt").read_text(encoding="ascii")
    grammar = gzip.decompress(base64.b64decode(grammar_payload))
    (root / "grammar.js").write_bytes(grammar)

    for relative in OBSOLETE:
        target = root / relative
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    shutil.rmtree(payload_dir)
    for relative in [
        "scripts/apply-v0.2-upgrade.py",
        ".github/workflows/refresh-generated.yml",
    ]:
        target = root / relative
        if target.exists():
            target.unlink()


if __name__ == "__main__":
    main()
