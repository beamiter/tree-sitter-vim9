//! Vim9 language support for the [tree-sitter] parsing library.
//!
//! ```
//! let code = "vim9script\nconst answer: number = 42\n";
//! let mut parser = tree_sitter::Parser::new();
//! parser
//!     .set_language(&tree_sitter_vim9::LANGUAGE.into())
//!     .expect("Error loading Vim9 parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_vim9() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for Vim9 script.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_vim9) };

/// The generated static node types.
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");
/// Syntax highlighting query.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");
/// Local-variable query.
pub const LOCALS_QUERY: &str = include_str!("../../queries/locals.scm");
/// Tags query.
pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");
/// Folding query.
pub const FOLDS_QUERY: &str = include_str!("../../queries/folds.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn can_load_and_parse_vim9() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Vim9 parser");
        let tree = parser
            .parse("vim9script\nconst answer: number = 42\n", None)
            .unwrap();
        assert!(!tree.root_node().has_error(), "{}", tree.root_node().to_sexp());
    }
}
