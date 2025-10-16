// grammar.js
// Tree-sitter grammar for a pragmatic subset of Vim9 script sufficient to parse the provided .vimrc.
//
// Key design points:
// - Newlines are significant separators. They are not part of `extras`.
// - Comments beginning with '#' are treated as standalone statement lines.
// - Generic Ex commands (set, map/*noremap, autocmd, augroup, command!, colorscheme, Plug, etc.)
//   are parsed by a flexible `command` rule whose args run until newline.
// - Function-call expressions require an immediate '(' after the name to avoid ambiguity with commands.
// - Indexing binds tighter than list literals to avoid ambiguity.
// - Line continuation lines starting with "\" are ignored as extras to allow wrapped long commands.
// - Statements must be separated by newlines at file and block scope to prevent `command_name` vs next
//   statement ambiguity.
//
// Implementation notes:
// - identifier/function_name share one underlying token (_name) and are distinguished by context.
// - raw_text allows '<' and '>' so mapping RHS like '<C-W>5<' parse without ERROR while special_key still wins.

module.exports = grammar({
  name: 'vim9',

  extras: $ => [
    // Whitespace but NOT newline; newline is a significant separator
    /[ \t\r\f]/,
    $.line_continuation,
  ],

  // Resolve ambiguity where a scope variable following a command name could be either a command arg
  // or the start of a new assignment statement.
  conflicts: $ => [
    [$.command, $.assignment],
    [$.command, $.let_statement],
  ],

  rules: {
    // File: statements separated by newlines, allowing extra blank lines.
    source_file: $ => seq(
      repeat(seq(optional($._statement), $.newline)),
      optional($._statement)
    ),

    // Newline token (significant)
    newline: $ => /\n/,

    // Lines beginning with '\' are treated as continuation extras and ignored by the parser
    line_continuation: $ => token(seq(/[ \t]*\\/, /[^\n]*/)),

    // A statement can be a comment line, command, assignment, vim9script directive, function def,
    // expression statement (function call), or control structures.
    _statement: $ => choice(
      $.comment,
      $.vim9script,
      $.command,
      $.assignment,
      $.let_statement,
      $.expr_statement,
      $.def_function,
      $.if_statement,
      $.for_statement
    ),

    // vim9script directive
    vim9script: $ => 'vim9script',

    // Comment lines: start with '#' and go to end-of-line
    comment: $ => seq('#', /[^\n]*/),

    // Generic Ex command support (e.g., set, nnoremap, autocmd, augroup, command!, colorscheme, Plug)
    command: $ => seq(
      $.command_name,
      optional($.command_args)
    ),

    // Command names allow trailing '!' (e.g., command!)
    command_name: $ => token(/[A-Za-z][A-Za-z0-9_-]*!?/),

    // Command arguments: a loose sequence of tokens until newline.
    // Includes strings, numbers, vars, identifiers, angle-bracket keys, pipes, lists/dicts, and raw chunks.
    command_args: $ => repeat1(choice(
      $.string,
      $.number,
      $.float,
      $.scope_var,
      $.option_var,
      $.identifier,
      $.special_key,
      $.pipe,
      $.list,
      $.dict,
      $.raw_text
    )),

    // Angle-bracketed keys (e.g., <C-W>w, <leader>, <Space>, <Plug>, <CR>, <c-u>, <expr>, <nowait>)
    special_key: $ => token(seq('<', /[^>]+/, '>')),
    pipe: $ => token('|'),

    // Raw text chunk until end-of-line.
    // Low precedence. Allows parentheses, braces, quotes, '=', ':', and now also '<' and '>'.
    // This lets mapping RHS with unpaired '<' or mixed content parse, while <key> still matches special_key.
    raw_text: $ => token(prec(-1, /[^{}\(\)\[\]\n]+/)),

    // Variable declaration (vim9 'var')
    let_statement: $ => seq('var', $.identifier, '=', $.expr),

    // Assignment to lvalues
    assignment: $ => seq($.lvalue, '=', $.expr),

    lvalue: $ => choice(
      $.scope_var,
      $.option_var,
      $.identifier,
      $.index_expression
    ),

    // Scope variables: g:, b:, w:, t:, l:, v:, s: followed by identifier
    scope_var: $ => token(seq(/[gbwtlvs]:/, /[A-Za-z_][A-Za-z0-9_]*/)),

    // Option variables: &name (e.g., &t_8f, &termguicolors)
    option_var: $ => token(seq('&', /[A-Za-z0-9_]+/)),

    // Indexing binds tighter than list literals
    index_expression: $ => prec.left(10, seq($.expr, '[', $.expr, ']')),

    // Expression-only statement (primarily function calls)
    expr_statement: $ => $.call_expression,

    // Function call: name '(' [args] ')'
    // Require immediate '(' after function name to avoid ambiguity with commands.
    call_expression: $ => seq(
      $.function_name,
      token.immediate('('),
      optional(seq($.expr, repeat(seq(',', $.expr)))),
      ')'
    ),

    // Single unified name token supporting optional # segments.
    _name: $ => token(/[A-Za-z_][A-Za-z0-9_]*(?:#[A-Za-z_][A-Za-z0-9_]*)*/),

    // Expose identifier and function_name via alias to avoid lexer competition
    identifier: $ => alias($._name, $.identifier),

    // Function names may include '#' segments (e.g., coc#pum#visible)
    function_name: $ => alias($._name, $.function_name),

    // Expressions
    expr: $ => choice(
      $.string,
      $.number,
      $.float,
      $.boolean,
      $.scope_var,
      $.option_var,
      $.identifier,
      $.call_expression,
      $.list,
      $.dict,
      $.index_expression,
      $.parenthesized_expression,
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression
    ),

    parenthesized_expression: $ => seq('(', $.expr, ')'),

    // List literal; lower precedence than index to avoid conflicts
    list: $ => prec(1, seq(
      '[',
      optional(seq($.expr, repeat(seq(',', $.expr)), optional(','))),
      ']'
    )),

    pair: $ => seq($.dict_key, ':', $.expr),
    dict_key: $ => choice($.identifier, $.string),

    dict: $ => seq(
      '{',
      optional(seq($.pair, repeat(seq(',', $.pair)), optional(','))),
      '}'
    ),

    number: $ => token(/[0-9]+/),
    float: $ => token(/[0-9]+\.[0-9]+/),
    boolean: $ => token(choice('true', 'false')),

    string: $ => token(choice(
      // Double-quoted with escapes
      /"(?:[^"\\]|\\.)*"/,
      // Single-quoted
      /'(?:[^'\\]|\\.)*'/
    )),

    unary_expression: $ => prec(7, choice(
      seq('!', $.expr),
      seq('-', $.expr)
    )),

    binary_expression: $ => choice(
      // String concat
      prec.left(3, seq($.expr, '..', $.expr)),
      // Arithmetic
      prec.left(5, seq($.expr, '+', $.expr)),
      prec.left(5, seq($.expr, '-', $.expr)),
      prec.left(6, seq($.expr, '*', $.expr)),
      prec.left(6, seq($.expr, '/', $.expr)),
      // Comparisons (including =~# used in the .vimrc)
      prec.left(4, seq($.expr, '==', $.expr)),
      prec.left(4, seq($.expr, '!=', $.expr)),
      prec.left(4, seq($.expr, '=~#', $.expr)),
      prec.left(4, seq($.expr, '>=', $.expr)),
      prec.left(4, seq($.expr, '<=', $.expr)),
      prec.left(4, seq($.expr, '>', $.expr)),
      prec.left(4, seq($.expr, '<', $.expr)),
      // Logical
      prec.left(2, seq($.expr, '&&', $.expr)),
      prec.left(1, seq($.expr, '||', $.expr))
    ),

    ternary_expression: $ => prec.right(0, seq($.expr, '?', $.expr, ':', $.expr)),

    // Vim9 def ... enddef
    def_function: $ => seq(
      'def',
      $.identifier,
      '(',
      optional(seq($.parameter, repeat(seq(',', $.parameter)))),
      ')',
      optional(seq(':', $.type)),
      // Body: statements separated by newline (allow blank lines)
      repeat(seq(optional($._statement), $.newline)),
      'enddef'
    ),

    parameter: $ => seq($.identifier, optional(seq(':', $.type))),

    // Basic types; allow identifiers as fallbacks (e.g., custom types)
    type: $ => choice(
      'bool', 'number', 'float', 'string',
      seq('list', '<', $.type, '>'),
      seq('dict', '<', $.type, '>'),
      $.identifier
    ),

    // if / elseif / else / endif
    if_statement: $ => seq(
      'if',
      $.expr,
      // Body: statements/newlines until elseif/else/endif
      repeat(seq(optional($._statement), $.newline)),
      repeat($.elseif_clause),
      optional($.else_clause),
      'endif'
    ),

    elseif_clause: $ => seq(
      'elseif',
      $.expr,
      repeat(seq(optional($._statement), $.newline))
    ),

    else_clause: $ => seq(
      'else',
      repeat(seq(optional($._statement), $.newline))
    ),

    // for ... in ... endfor
    for_statement: $ => seq(
      'for',
      $.identifier,
      'in',
      $.expr,
      repeat(seq(optional($._statement), $.newline)),
      'endfor'
    ),
  }
});
