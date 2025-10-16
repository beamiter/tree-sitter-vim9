// grammar.js
// Pragmatic Tree-sitter grammar for a Vim9-like .vimrc subset.
//
// Design:
// - Newlines are significant separators (not extras).
// - Comments starting with '#' are standalone statement lines.
// - Generic Ex commands are parsed by `command`.
// - Function calls require an immediate '(' to avoid ambiguity with commands.
// - Indexing binds tighter than list/dict literals.
// - '\' line continuations are ignored as extras.
// - Prefer reserved constructs (vim9script/var/def/if/for/assignments) over generic commands.
// - identifier/function_name share one token; context decides via immediate '(' for calls.
// - raw_text 用作命令兜底：当命令参数中出现复杂 RHS 时整行吞掉，避免 ERROR。

module.exports = grammar({
  name: 'vim9',

  extras: $ => [
    /[ \t\r\f]/,
    $.line_continuation,
  ],

  conflicts: $ => [
    [$.command, $.assignment],
    [$.command, $.let_statement],
    [$.command, $.expr_statement],
  ],

  rules: {
    source_file: $ => seq(
      repeat(seq(optional($._statement), $.newline)),
      optional($._statement)
    ),

    newline: $ => /\n/,

    // Lines beginning with '\' are treated as continuation extras and ignored by the parser
    line_continuation: $ => token(seq(/[ \t]*\\/, /[^\n]*/)),

    // Prefer reserved constructs first, then fallback to generic command.
    _statement: $ => choice(
      $.comment,
      $.vim9script,
      $.let_statement,          // var ...
      $.assignment,             // lvalue = expr
      $.def_function,           // def ... enddef
      $.if_statement,           // if/elseif/else/endif
      $.for_statement,          // for ... in ... endfor
      $.expr_statement,         // call-expression statement
      $.command                 // fallback: generic Ex command
    ),

    // vim9script directive
    vim9script: $ => 'vim9script',

    // Comment lines
    comment: $ => seq('#', /[^\n]*/),

    // 安全的结构化命令参数项（不含 raw_text，避免与兜底分支冲突）
    safe_arg: $ => choice(
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
      $.call_expression
    ),

    // Generic Ex command
    // 定点爆破：先匹配带安全参数的分支；其次仅命令名；最后兜底：安全参数若干 + 行尾 raw_text
    command: $ => choice(
      prec(2, seq($.command_name, $.command_args)),
      prec(1, seq($.command_name)),
      prec(0, seq($.command_name, repeat($.safe_arg), $.raw_text))
    ),

    // Command names: require at least two characters to avoid single-letter scope prefixes like 'g', 'b', ...
    command_name: $ => token(prec(1, /[A-Za-z][A-Za-z0-9_-]+!?/)),

    // Command args：仅接受安全参数项；不含 raw_text，以避免与兜底分支产生二义性
    command_args: $ => repeat1($.safe_arg),

    // Angle-bracketed keys (<C-w>, <leader>, <CR>, <Plug> ...)
    special_key: $ => token(seq('<', /[^>]+/, '>')),
    pipe: $ => token('|'),

    // Raw text chunk until EOL; low precedence lets specific tokens win
    raw_text: $ => token(prec(-1, /[^\n]+/)),

    // var declaration
    let_statement: $ => prec(2, seq('var', $.identifier, '=', $.expr)),

    // Assignment
    assignment: $ => prec(2, seq($.lvalue, '=', $.expr)),

    lvalue: $ => choice(
      $.scope_var,
      $.option_var,
      $.identifier,
      $.index_expression
    ),

    // Scope variables: g:, b:, w:, t:, l:, v:, s:
    scope_var: $ => token(seq(/[gbwtlvs]:/, /[A-Za-z_][A-Za-z0-9_]*/)),

    // Option variables: &name
    option_var: $ => token(seq('&', /[A-Za-z0-9_]+/)),

    // Indexing binds tighter than list literals
    index_expression: $ => prec.left(10, seq($.expr, '[', $.expr, ']')),

    // Expression-only statement: function call
    expr_statement: $ => $.call_expression,

    // Function call: name '(' args ')', with immediate '(' to disambiguate from command
    call_expression: $ => seq(
      $.function_name,
      token.immediate('('),
      optional(seq($.expr, repeat(seq(',', $.expr)))),
      ')'
    ),

    // 单个统一 name token
    _name: $ => token(/[A-Za-z_][A-Za-z0-9_]*(?:#[A-Za-z_][A-Za-z0-9_]*)*/),

    identifier: $ => alias($._name, $.identifier),
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

    // 括号表达式支持多实参（逗号分隔）
    parenthesized_expression: $ => seq(
      '(',
      optional(seq($.expr, repeat(seq(',', $.expr)))),
      ')'
    ),

    // List literal; support optional newlines between items and trailing comma
    list: $ => prec(1, seq(
      '[',
      optional(seq(
        repeat($.newline),
        $.expr,
        repeat(seq(
          repeat($.newline),
          ',',
          repeat($.newline),
          $.expr
        )),
        optional(seq(repeat($.newline), ','))
      )),
      repeat($.newline),
      ']'
    )),

    pair: $ => seq($.dict_key, ':', $.expr),
    dict_key: $ => choice($.identifier, $.string),

    // Dict literal; support optional newlines between pairs and trailing comma
    dict: $ => seq(
      '{',
      optional(seq(
        repeat($.newline),
        $.pair,
        repeat(seq(
          repeat($.newline),
          ',',
          repeat($.newline),
          $.pair
        )),
        optional(seq(repeat($.newline), ','))
      )),
      repeat($.newline),
      '}'
    ),

    number: $ => token(/[0-9]+/),
    float: $ => token(/[0-9]+\.[0-9]+/),
    boolean: $ => token(choice('true', 'false')),

    string: $ => token(choice(
      /"(?:[^"\\]|\\.)*"/,
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
      // Comparisons
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
      repeat(seq(optional($._statement), $.newline)),
      'enddef'
    ),

    parameter: $ => seq($.identifier, optional(seq(':', $.type))),

    // Types (basic + generic + allow identifiers)
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
