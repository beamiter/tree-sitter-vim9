# tree-sitter-vim9

[![CI](https://github.com/beamiter/tree-sitter-vim9/actions/workflows/ci.yml/badge.svg)](https://github.com/beamiter/tree-sitter-vim9/actions/workflows/ci.yml)

A **Vim9-first** Tree-sitter grammar for modern Vim script. The parser focuses on typed Vim9 code while retaining a tolerant fallback for Ex commands and user-defined commands.

## Highlights

- Typed declarations: `var`, `final`, `const`, generic types, function types, and type aliases.
- Modern definitions: `def`, nested functions, imports/exports, classes, interfaces, and enums.
- Structured flow control: nested `if`, `for`, `while`, and `try`/`catch`/`finally` blocks.
- Rich expressions: calls, method pipelines, members, indexing, slicing, lambdas, collections, interpolation, and precedence-aware operators.
- Editor integration: highlight, local-variable, tag, and fold queries.
- First-class C, Go, Node.js, Python, Rust, and Swift bindings.
- Corpus tests and CI on Linux, macOS, and Windows.

## Example

```vim
vim9script

export def Sum(values: list<number>): number
  var total = 0
  for value in values
    if value > 0
      total += value
    endif
  endfor
  return total
enddef
```

## Development

Tree-sitter CLI 0.25 or newer is recommended.

```sh
npm install
npm run generate
npm test
```

Useful focused commands:

```sh
npm run test:corpus
npm run test:queries
npm run build
```

The generated files under `src/` are committed. After changing `grammar.js`, regenerate them and include the resulting diff.

## Language scope

This project intentionally prioritizes Vim9 syntax. Unknown built-in commands and plugin commands are preserved as `command_statement` nodes instead of forcing the grammar to enumerate every Ex command. That keeps parsing resilient as Vim and plugins evolve.

The current grammar does not attempt to fully parse legacy Vimscript-only constructs, heredoc bodies, or every command-specific argument language. Those forms remain recoverable through Tree-sitter's error recovery or the generic command fallback.

## Bindings

The canonical language symbol is `tree_sitter_vim9` in every binding. Python exposes the `tree_sitter_vim9` module; the previous `tree_sitter_vim` import remains as a compatibility shim.

## License

MIT. See [LICENSE](LICENSE).
