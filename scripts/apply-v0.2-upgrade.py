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

GRAMMAR_GZIP_B64 = """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"""


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

    grammar = gzip.decompress(base64.b64decode(GRAMMAR_GZIP_B64))
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
