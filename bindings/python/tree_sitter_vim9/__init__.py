"""Vim9 language support for tree-sitter."""

from importlib.resources import files as _files

from ._binding import language


def _get_query(name: str, filename: str) -> str:
    value = (_files(f"{__package__}.queries") / filename).read_text(encoding="utf8")
    globals()[name] = value
    return value


def __getattr__(name: str) -> str:
    queries = {
        "HIGHLIGHTS_QUERY": "highlights.scm",
        "LOCALS_QUERY": "locals.scm",
        "TAGS_QUERY": "tags.scm",
        "FOLDS_QUERY": "folds.scm",
    }
    if filename := queries.get(name):
        return _get_query(name, filename)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "language",
    "HIGHLIGHTS_QUERY",
    "LOCALS_QUERY",
    "TAGS_QUERY",
    "FOLDS_QUERY",
]
