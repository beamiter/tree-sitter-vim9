package tree_sitter_vim_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_vim "github.com/beamiter/tree-sitter-vim9/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_vim.Language())
	if language == nil {
		t.Errorf("Error loading Vim grammar")
	}
}
