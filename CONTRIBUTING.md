# Contributing

1. Add or update a focused case under `test/corpus/`.
2. Change `grammar.js` and regenerate the parser with `npm run generate`.
3. Run `npm test` and ensure generated files are committed.
4. Keep unknown Ex commands parseable through `command_statement` unless a dedicated node materially improves tooling.

Grammar changes should preserve incremental parsing, avoid broad tokens that consume `|`, `#`, or newlines, and use fields on nodes intended for editor queries.
