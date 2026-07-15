const assert = require("node:assert/strict");
const { test } = require("node:test");

const Parser = require("tree-sitter");
const Vim9 = require(".");

test("loads and parses Vim9 script", () => {
  const parser = new Parser();
  parser.setLanguage(Vim9);

  const tree = parser.parse([
    "vim9script",
    "const answer: number = 42",
    "export def Double(value: number): number",
    "  return value * 2",
    "enddef",
    "",
  ].join("\n"));

  assert.equal(tree.rootNode.type, "source_file");
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
});

test("ships editor queries", () => {
  assert.match(Vim9.highlightsQuery, /@keyword/);
  assert.match(Vim9.localsQuery, /@local\.scope/);
  assert.match(Vim9.tagsQuery, /@definition\.function/);
  assert.match(Vim9.foldsQuery, /@fold/);
});
