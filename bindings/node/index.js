const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const binding =
  typeof process.versions.bun === "string"
    ? require(`../../prebuilds/${process.platform}-${process.arch}/tree-sitter-vim9.node`)
    : require("node-gyp-build")(root);

try {
  binding.nodeTypeInfo = require("../../src/node-types.json");
} catch (_) {}

for (const [property, file] of Object.entries({
  highlightsQuery: "highlights.scm",
  localsQuery: "locals.scm",
  tagsQuery: "tags.scm",
  foldsQuery: "folds.scm",
})) {
  Object.defineProperty(binding, property, {
    configurable: true,
    enumerable: true,
    get() {
      const value = fs.readFileSync(path.join(root, "queries", file), "utf8");
      Object.defineProperty(binding, property, { value, enumerable: true });
      return value;
    },
  });
}

module.exports = binding;
