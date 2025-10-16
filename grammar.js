// grammar.js
// Pragmatic Tree-sitter grammar for a Vim9-like .vimrc subset.

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
    [$.parameter, $.expr],
    [$.parenthesized_expression, $.arrow_function],
    [$.arguments, $.parameter],
    [$.block, $.dict],
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
      $.const_statement,        // 新增 const
      $.let_statement,          // var ...
      $.assignment,             // lvalue = expr
      $.def_function,           // def ... enddef / export def ... enddef
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
    // 修正：不跨行
    special_key: $ => token(seq('<', /[^>\n]+/, '>')),
    pipe: $ => token('|'),

    // Raw text chunk until EOL; low precedence lets specific tokens win
    raw_text: $ => token(prec(-1, /[^\n]+/)),

    // const declaration（新增）
    const_statement: $ => prec(2, seq(
      'const',
      $.identifier,
      optional(seq(':', $.type)),
      '=',
      $.expr
    )),

    // var declaration（支持可选类型注解）
    let_statement: $ => prec(2, seq(
      'var',
      $.identifier,
      optional(seq(':', $.type)),
      '=',
      $.expr
    )),

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

    // 统一 name token
    _name: $ => token(/[A-Za-z_][A-Za-z0-9_]*(?:#[A-Za-z_][A-Za-z0-9_]*)*/),

    identifier: $ => alias($._name, $.identifier),
    function_name: $ => alias($._name, $.function_name),

    // Function call: name '(' args ')', with immediate '(' to disambiguate from command
    call_expression: $ => seq(
      $.function_name,
      token.immediate('('),
      optional($.arguments),
      ')'
    ),

    // 通用实参列表
    arguments: $ => seq($.expr, repeat(seq(',', $.expr))),

    // 箭头函数：提高优先级并设为右结合
    arrow_function: $ => prec.right(2, seq(
      '(',
      optional(seq($.parameter, repeat(seq(',', $.parameter)))),
      ')',
      '=>',
      choice($.expr, $.block)
    )),

    // 箭头函数体的块（行分隔用显式换行符）
    block: $ => seq(
      '{',
      repeat(choice(
        $.newline,
        seq(optional($._statement), $.newline)
      )),
      '}'
    ),

    // Vim9 def ... enddef（支持可选 export）
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

    // Types (basic + generic + allow identifiers)
    type: $ => choice(
      'bool', 'number', 'float', 'string', 'any',
      seq('list', '<', $.type, '>'),
      seq('dict', '<', $.type, '>'),
      $.identifier
    ),

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
      $.arrow_function,          // 新增
      $.method_call,             // 新增 expr->func(args)
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
      optional($.arguments),
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

    // 方法/管道调用（新增）：expr -> identifier(...)
    method_call: $ => prec.left(9, seq(
      $.expr,
      '->',
      $.identifier,
      '(',
      optional($.arguments),
      ')'
    )),

    // 扩展比较/匹配等运算符
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
