// grammar.js
// Pragmatic Tree-sitter grammar for a Vim9-like .vimrc subset.
// 增强点：
// - 行内 | 链式语句
// - 复合赋值 ..=、+=、-=、*=、/=
// - for 解构变量 [k, v]
// - 切片索引 expr[ start? : end? ]（可与索引链式）
// - 顶层同时支持“结构化语句块”（def/if/for）和“可链语句行”
// - command 简化为：name + repeat(safe_arg) + optional(raw_text)

module.exports = grammar({
  name: 'vim9',

  extras: $ => [
    /[ \t\r\f]/,
    // 不把续行放到 extras
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
    // ========== 行级与顶层组织 ==========
    // 可链式语句（同一行可用 | 连接多条）
    chainable_statement: $ => choice(
      $.comment,
      $.vim9script,
      $.command,
      $.expr_statement,
      $.assignment,
      $.augmented_assignment,
      $.let_statement,
      $.const_statement
    ),

    // 用单个 | 分隔
    statement_chain: $ => seq(
      $.chainable_statement,
      repeat(seq('|', $.chainable_statement))
    ),

    // 结构化语句块（自身处理多行）
    structured_statement: $ => choice(
      $.def_function,
      $.if_statement,
      $.for_statement
    ),

    // 顶层：结构化块 或 行（含链式 + 续行）
    source_file: $ => seq(
      repeat(choice(
        $.structured_statement,
        seq(optional($.statement_chain), repeat($.continued_line), $.newline)
      )),
      optional(seq(
        optional($.statement_chain),
        repeat($.continued_line)
      ))
    ),

    newline: $ => /\n/,

    // 续行：行首空白 + \ + 非换行若干 + 换行
    continued_line: $ => seq(/[ \t]*\\[^\n]*/, $.newline),

    // 备用（块内也会用到的“单条语句”入口）
    _statement: $ => choice(
      $.comment,
      $.vim9script,
      $.const_statement,
      $.let_statement,
      $.assignment,
      $.augmented_assignment,
      $.def_function,
      $.if_statement,
      $.for_statement,
      $.expr_statement,
      $.command
    ),

    // ========== 基础元素 ==========
    vim9script: $ => 'vim9script',

    comment: $ => seq('#', /[^\n]*/),

    // 特殊键 <CR> 等
    special_key: $ => token(seq('<', /[^>\n]+/, '>')),

    // 不吞掉 '|' 或 '\n'
    raw_text: $ => token(prec(-1, /[^|\n]+/)),

    // ========== 命令（Ex） ==========
    // 统一简化：name + 0+ safe_arg + 可选 raw_text
    command: $ => seq(
      $.command_name,
      repeat($.safe_arg),
      optional($.raw_text)
    ),

    command_name: $ => token(prec(1, /[A-Za-z][A-Za-z0-9_-]+!?/)),

    // 安全参数：避免把 '|' 当作参数
    safe_arg: $ => choice(
      $.string,
      $.number,
      $.float,
      $.scope_var,
      $.option_var,
      $.identifier,
      $.special_key,
      $.list,
      $.dict,
      $.call_expression
    ),

    // ========== 变量与赋值 ==========
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

    // 普通赋值
    assignment: $ => prec(2, seq($.lvalue, '=', $.expr)),

    // 复合赋值
    augmented_assignment: $ => prec(2, seq(
      $.lvalue,
      choice('..=', '+=', '-=', '*=', '/='),
      $.expr
    )),

    lvalue: $ => choice(
      $.scope_var,
      $.option_var,
      $.identifier,
      $.index_expression
    ),

    scope_var: $ => token(seq(/[gbwtlvs]:/, /[A-Za-z_][A-Za-z0-9_]*/)),
    option_var: $ => token(seq('&', /[A-Za-z0-9_]+/)),

    // ========== 表达式 ==========
    // 索引/切片，可链式：a[1][ : 3]
    index_expression: $ => prec.left(10, seq(
      $.expr,
      repeat1(choice(
        // 索引
        seq('[', $.expr, ']'),
        // 切片 [start? : end?]
        seq('[', optional($.expr), ':', optional($.expr), ']')
      ))
    )),

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

    // 代码块：每行允许链式语句
    block: $ => seq(
      '{',
      repeat(choice(
        $.newline,
        seq(optional($.statement_chain), $.newline)
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
      repeat(seq(optional($.statement_chain), $.newline)),
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

    // ========== 控制结构 ==========
    if_statement: $ => seq(
      'if',
      $.expr,
      repeat(seq(optional($.statement_chain), $.newline)),
      repeat($.elseif_clause),
      optional($.else_clause),
      'endif'
    ),

    elseif_clause: $ => seq(
      'elseif',
      $.expr,
      repeat(seq(optional($.statement_chain), $.newline))
    ),

    else_clause: $ => seq(
      'else',
      repeat(seq(optional($.statement_chain), $.newline))
    ),

    // for 支持解构变量 [k, v]
    list_pattern: $ => seq(
      '[',
      $.identifier,
      repeat(seq(',', $.identifier)),
      ']'
    ),

    for_statement: $ => seq(
      'for',
      choice($.identifier, $.list_pattern),
      'in',
      $.expr,
      repeat(seq(optional($.statement_chain), $.newline)),
      'endfor'
    ),
  }
});
