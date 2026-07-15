package tree_sitter_vim9

// #cgo CFLAGS: -std=c11 -fPIC
// #include "../../src/parser.c"
// #if __has_include("../../src/scanner.c")
// #include "../../src/scanner.c"
// #endif
import "C"

import "unsafe"

// Language returns the tree-sitter language for Vim9 script.
func Language() unsafe.Pointer {
	return unsafe.Pointer(C.tree_sitter_vim9())
}
