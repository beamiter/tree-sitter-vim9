// grammar.js
// Pragmatic Tree-sitter grammar for a Vim9-like .vimrc subset.

module.exports = grammar({
  name: 'vim9',

  extras: $ => [
    /[ \t\r\f]/,
    // 移除 line_continuation 出现在 extras 中，防止误吞任意 '\'
    // $.line_continuation,
  ],

  conflicts: $ => [
    [$.command, $.assignment],
    [$.command, $.let_statement],
    [$.command, $.expr_statement],
    [$.parameter, $.expr],
    [$.parenthesized_expression, $.arrow_function],
    [$.arguments, $.parameter],
    [$.block, $.dict],
  ],

  rules: {
    // 可选增强：在语法层显式支持续行（反斜杠开头的“附加行”）
    // 如果暂不需要续行功能，可删除 continued_line 并恢复最初的 source_file。
    source_file: $ => seq(
      repeat(seq(
        optional($._statement),
        // 若有续行，则可以跟若干续行行（每个续行行内自带 newline）
        repeat($.continued_line),
        $.newline
      )),
      optional(seq(
        optional($._statement),
        repeat($.continued_line)
      ))
    ),

    newline: $ => /\n/,

    // 原 extras 的 line_continuation 删除。这里提供基于语法层的续行行定义：
    // 规则：行首可有若干空格/Tab，然后一个反斜杠，后面到行尾任何内容，最后必须是换行符。
    // 说明：这不是 Vim 的全部细节（例如续行与注释/字符串的交互），但能避免误吞。
    continued_line: $ => seq(/[ \t]*\\[^\n]*/, $.newline),

    // Prefer reserved constructs first, then fallback to generic command.
    _statement: $ => choice(
      $.comment,
      $.vim9script,
      $.const_statement,
      $.let_statement,
      $.assignment,
      $.def_function,
      $.if_statement,
      $.for_statement,
      $.expr_statement,
      $.command
    ),

    // vim9script directive
    vim9script: $ => 'vim9script',

    // Comment lines
    comment: $ => seq('#', /[^\n]*/),

    // 安全参数项
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
    command: $ => choice(
      prec(2, seq($.command_name, $.command_args)),
      prec(1, seq($.command_name)),
      prec(0, seq($.command_name, repeat($.safe_arg), $.raw_text))
    ),

    command_name: $ => token(prec(1, /[A-Za-z][A-Za-z0-9_-]+!?/)),
    command_args: $ => repeat1($.safe_arg),

    special_key: $ => token(seq('<', /[^>\n]+/, '>')),
    pipe: $ => token('|'),

    raw_text: $ => token(prec(-1, /[^\n]+/)),

    // const/var
    const_statement: $ => prec(2, seq(
      'const',
      $.identifier,
      optional(seq(':', $.type)),
      '=',
      $.expr
    )),

    let_statement: $ => prec(2, seq(
      'var',
      $.identifier,
      optional(seq(':', $.type)),
      '=',
      $.expr
    )),

    assignment: $ => prec(2, seq($.lvalue, '=', $.expr)),

    lvalue: $ => choice(
      $.scope_var,
      $.option_var,
      $.identifier,
      $.index_expression
    ),

    scope_var: $ => token(seq(/[gbwtlvs]:/, /[A-Za-z_][A-Za-z0-9_]*/)),
    option_var: $ => token(seq('&', /[A-Za-z0-9_]+/)),

    index_expression: $ => prec.left(10, seq($.expr, '[', $.expr, ']')),

    // 表达式语句：加入 method_call（修复）
    expr_statement: $ => choice(
      $.call_expression,
      $.method_call
    ),

    _name: $ => token(/[A-Za-z_][A-Za-z0-9_]*(?:#[A-Za-z_][A-Za-z0-9_]*)*/),

    identifier: $ => alias($._name, $.identifier),
    function_name: $ => alias($._name, $.function_name),

    call_expression: $ => seq(
      $.function_name,
      token.immediate('('),
      optional($.arguments),
      ')'
    ),

    arguments: $ => seq($.expr, repeat(seq(',', $.expr))),

    arrow_function: $ => prec.right(2, seq(
      '(',
      optional(seq($.parameter, repeat(seq(',', $.parameter)))),
      ')',
      '=>',
      choice($.expr, $.block)
    )),

    block: $ => seq(
      '{',
      repeat(choice(
        $.newline,
        seq(optional($._statement), $.newline)
      )),
      '}'
    ),

    def_function: $ => seq(
      optional('export'),
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

    type: $ => choice(
      'bool', 'number', 'float', 'string', 'any',
      seq('list', '<', $.type, '>'),
      seq('dict', '<', $.type, '>'),
      $.identifier
    ),

    expr: $ => choice(
      $.string,
      $.number,
      $.float,
      $.boolean,
      $.scope_var,
      $.option_var,
      $.identifier,
      $.call_expression,
      $.arrow_function,
      $.method_call,
      $.list,
      $.dict,
      $.index_expression,
      $.parenthesized_expression,
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression
    ),

    // 改为只允许单一表达式，降低冲突（修复）
    parenthesized_expression: $ => seq(
      '(',
      optional($.expr),
      ')'
    ),

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

    method_call: $ => prec.left(9, seq(
      $.expr,
      '->',
      $.identifier,
      '(',
      optional($.arguments),
      ')'
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
      prec.left(4, seq($.expr, '==',  $.expr)),
      prec.left(4, seq($.expr, '!=',  $.expr)),
      prec.left(4, seq($.expr, '==#', $.expr)),
      prec.left(4, seq($.expr, '!=#', $.expr)),
      prec.left(4, seq($.expr, '==?', $.expr)),
      prec.left(4, seq($.expr, '!=?', $.expr)),
      prec.left(4, seq($.expr, '=~',  $.expr)),
      prec.left(4, seq($.expr, '!~',  $.expr)),
      prec.left(4, seq($.expr, '=~#', $.expr)),
      prec.left(4, seq($.expr, '!~#', $.expr)),
      prec.left(4, seq($.expr, '>=',  $.expr)),
      prec.left(4, seq($.expr, '<=',  $.expr)),
      prec.left(4, seq($.expr, '>',   $.expr)),
      prec.left(4, seq($.expr, '<',   $.expr)),
      // Logical
      prec.left(2, seq($.expr, '&&', $.expr)),
      prec.left(1, seq($.expr, '||', $.expr))
    ),

    ternary_expression: $ => prec.right(0, seq($.expr, '?', $.expr, ':', $.expr)),

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
