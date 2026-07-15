import XCTest
import SwiftTreeSitter
import TreeSitterVim9

final class TreeSitterVim9Tests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_vim9())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Vim9 grammar")
    }
}
