// swift-tools-version:5.3

import Foundation
import PackageDescription

var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterVim9",
    products: [
        .library(name: "TreeSitterVim9", targets: ["TreeSitterVim9"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.9.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterVim9",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [.copy("queries")],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterVim9Tests",
            dependencies: ["SwiftTreeSitter", "TreeSitterVim9"],
            path: "bindings/swift/TreeSitterVim9Tests"
        ),
    ],
    cLanguageStandard: .c11
)
