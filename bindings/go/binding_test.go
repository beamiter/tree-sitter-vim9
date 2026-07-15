package tree_sitter_vim9_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_vim9 "github.com/beamiter/tree-sitter-vim9/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_vim9.Language())
	if language == nil {
		t.Fatal("failed to load Vim9 grammar")
	}
}
