from tree_sitter import Language, Parser
import tree_sitter_vim
import tree_sitter_vim9


def test_can_load_and_parse_grammar():
    language = Language(tree_sitter_vim9.language())
    parser = Parser(language)
    tree = parser.parse(b"vim9script\nconst answer: number = 42\n")
    assert tree.root_node.type == "source_file"
    assert not tree.root_node.has_error


def test_legacy_import_is_compatible():
    assert tree_sitter_vim.language is tree_sitter_vim9.language


def test_queries_are_packaged():
    assert "@keyword" in tree_sitter_vim9.HIGHLIGHTS_QUERY
    assert "@fold" in tree_sitter_vim9.FOLDS_QUERY
