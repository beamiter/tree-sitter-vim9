/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  TERNARY: 1,
  COALESCE: 2,
  OR: 3,
  AND: 4,
  COMPARE: 5,
  CONCAT: 6,
  ADD: 7,
  MULTIPLY: 8,
  UNARY: 9,
  CALL: 10,
  MEMBER: 11,
};

const PRIMITIVE_TYPES = [
  'any',
  'bool',
  'blob',
  'channel',
  'float',
  'func',
  'job',
  'number',
  'object',
  'partial',
  'special',
  'string',
  'void',
];

module.exports = grammar({
  name: 'vim9',

  word: $ => $.identifier,

  supertypes: $ => [
    $._statement,
    $._simple_statement,
    $._expression,
    $._type,
  ],

  extras: $ => [
    /[ \t\r\f]/,
    $.line_continuation,
  ],

  conflicts: $ => [
    [$.parenthesized_expression, $.lambda_expression],
    [$.call_expression, $.method_call_expression],
    [$.member_expression, $.method_call_expression],
    [$.list_expression, $.list_pattern],
    [$.dictionary_expression, $.block_expression],
    [$.type_name, $.identifier],
    [$.parameter, $._expression],
    [$._binding_pattern, $._expression],
    [$.blank_line, $.dictionary_expression, $.block_expression],
    [$.blank_line, $.dictionary_expression],
    [$.blank_line, $.block_expression],
    [$._expression, $.lambda_expression],
    [$.member_lvalue, $.member_expression],
    [$.index_lvalue, $.index_expression],
  ],

  rules: {
    source_file: $ => seq(
      repeat($._terminated_item),
      optional($._unterminated_item),
    ),

    _terminated_item: $ => choice(
      $.blank_line,
      seq($.comment, $.newline),
      seq(choice($._compound_statement, $.statement_chain), optional($.comment), $.newline),
    ),

    _unterminated_item: $ => choice(
      $.comment,
      $._compound_statement,
      $.statement_chain,
    ),

    _body: $ => repeat1($._terminated_item),

    blank_line: $ => $.newline,
    newline: _ => /\n/,
    line_continuation: _ => token(seq('\\', /[^\n]*/, /\n[ \t]*/)),
    comment: _ => token(seq('#', optional(/[^{\n][^\n]*/))),

    statement_chain: $ => seq(
      $._simple_statement,
      repeat(seq('|', $._simple_statement)),
    ),

    _statement: $ => choice(
      $._compound_statement,
      $._simple_statement,
    ),

    _compound_statement: $ => choice(
      $.function_definition,
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.try_statement,
      $.class_definition,
      $.interface_definition,
      $.enum_definition,
    ),

    _simple_statement: $ => choice(
      $.vim9script_statement,
      $.import_statement,
      $.type_alias_statement,
      $.variable_declaration,
      $.assignment_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.finish_statement,
      $.throw_statement,
      $.defer_statement,
      $.echo_statement,
      $.execute_statement,
      $.expression_statement,
      $.abstract_method_declaration,
      $.command_statement,
    ),

    vim9script_statement: $ => seq(
      'vim9script',
      optional(choice('noclear', seq('no', 'clear'))),
    ),

    import_statement: $ => seq(
      'import',
      optional('autoload'),
      field('path', $._expression),
      optional(seq('as', field('alias', $.identifier))),
    ),

    type_alias_statement: $ => seq(
      optional('export'),
      'type',
      field('name', $.type_name),
      '=',
      field('value', $._type),
    ),

    declaration_modifiers: _ => repeat1(choice('export', 'public', 'static')),

    variable_declaration: $ => seq(
      optional($.declaration_modifiers),
      field('kind', choice('var', 'final', 'const')),
      field('pattern', $._binding_pattern),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expression))),
    ),

    assignment_statement: $ => prec.right(1, seq(
      field('left', $._assignable),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '%=', '..=', '&&=', '||=', '??=')),
      field('right', $._expression),
    )),

    return_statement: $ => seq('return', optional(field('value', $._expression))),
    break_statement: _ => 'break',
    continue_statement: _ => 'continue',
    finish_statement: _ => 'finish',
    throw_statement: $ => seq('throw', field('value', $._expression)),
    defer_statement: $ => seq('defer', field('call', choice($.call_expression, $.method_call_expression))),

    echo_statement: $ => seq(
      field('command', choice('echo', 'echomsg', 'echoerr', 'echowindow')),
      repeat1($._expression),
    ),

    execute_statement: $ => seq(
      field('command', choice('execute', 'eval', 'call')),
      repeat1($._expression),
    ),

    expression_statement: $ => prec(2, choice(
      $.call_expression,
      $.method_call_expression,
      $.member_expression,
      $.index_expression,
    )),

    command_statement: $ => prec(-10, seq(
      optional(':'),
      field('name', alias($.identifier, $.command_name)),
      optional(token.immediate('!')),
      optional(field('arguments', $.command_arguments)),
    )),

    command_arguments: _ => token(prec(1, /[^|#\n]+/)),

    function_definition: $ => seq(
      optional($.function_modifiers),
      'def',
      field('name', $._function_name),
      field('parameters', $.parameters),
      optional(seq(':', field('return_type', $._type))),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
      'enddef',
    ),

    function_modifiers: _ => repeat1(choice('export', 'public', 'static')),

    abstract_method_declaration: $ => seq(
      optional('public'),
      'abstract',
      'def',
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional(seq(':', field('return_type', $._type))),
    ),

    parameters: $ => seq(
      '(',
      multilineCommaSep($, $.parameter),
      ')',
    ),

    parameter: $ => seq(
      optional('...'),
      field('name', choice($.identifier, $.member_lvalue)),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('default', $._expression))),
    ),

    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      optional($.comment),
      $.newline,
      optional(field('consequence', $._body)),
      repeat($.elseif_clause),
      optional($.else_clause),
      'endif',
    ),

    elseif_clause: $ => seq(
      'elseif',
      field('condition', $._expression),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
    ),

    else_clause: $ => seq(
      'else',
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
    ),

    for_statement: $ => seq(
      'for',
      field('pattern', $._binding_pattern),
      'in',
      field('iterable', $._expression),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
      'endfor',
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $._expression),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
      'endwhile',
    ),

    try_statement: $ => seq(
      'try',
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
      repeat($.catch_clause),
      optional($.finally_clause),
      'endtry',
    ),

    catch_clause: $ => seq(
      'catch',
      optional(field('pattern', choice($.string, $.regex_pattern))),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
    ),

    finally_clause: $ => seq(
      'finally',
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
    ),

    class_definition: $ => seq(
      optional('export'),
      optional('abstract'),
      'class',
      field('name', $.type_name),
      optional(seq('extends', field('superclass', $.type_name))),
      optional(seq('implements', field('interfaces', commaSep1($.type_name)))),
      optional($.comment),
      $.newline,
      optional(field('body', $._body)),
      'endclass',
    ),

    interface_definition: $ => seq(
      optional('export'),
      'interface',
      field('name', $.type_name),
      optional(seq('extends', field('interfaces', commaSep1($.type_name)))),
      optional($.comment),
      $.newline,
      field('body', repeat(choice(
        $.blank_line,
        seq($.comment, $.newline),
        seq(choice($.interface_method_declaration, $.variable_declaration), optional($.comment), $.newline),
      ))),
      'endinterface',
    ),

    interface_method_declaration: $ => seq(
      optional('static'),
      'def',
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional(seq(':', field('return_type', $._type))),
    ),

    enum_definition: $ => seq(
      optional('export'),
      'enum',
      field('name', $.type_name),
      optional(seq('implements', field('interfaces', commaSep1($.type_name)))),
      optional($.comment),
      $.newline,
      optional(field('values', $.enum_values)),
      optional(field('body', $._body)),
      'endenum',
    ),

    enum_values: $ => prec.right(1, repeat1(seq(
      commaSep1($.enum_value),
      optional(','),
      optional($.comment),
      $.newline,
    ))),

    enum_value: $ => prec(1, seq(
      field('name', $.identifier),
      optional(field('arguments', $.arguments)),
    )),

    _binding_pattern: $ => choice(
      $.identifier,
      $.scoped_identifier,
      $.list_pattern,
    ),

    list_pattern: $ => seq(
      '[',
      optional(seq(
        field('element', $._binding_pattern),
        repeat(seq(',', field('element', $._binding_pattern))),
        optional(seq(';', field('rest', $._binding_pattern))),
      )),
      ']',
    ),

    _assignable: $ => choice(
      $.identifier,
      $.scoped_identifier,
      $.option_variable,
      $.environment_variable,
      $.register_variable,
      $.member_lvalue,
      $.index_lvalue,
      $.list_pattern,
    ),

    member_lvalue: $ => prec.left(PREC.MEMBER, seq(
      field('object', $._expression),
      '.',
      field('property', $.identifier),
    )),

    index_lvalue: $ => prec.left(PREC.MEMBER, seq(
      field('object', $._expression),
      '[',
      field('index', $._expression),
      ']',
    )),

    _function_name: $ => choice(
      $.identifier,
      $.scoped_identifier,
      $.autoload_identifier,
    ),

    _expression: $ => choice(
      $.identifier,
      $.scoped_identifier,
      $.autoload_identifier,
      $.option_variable,
      $.environment_variable,
      $.register_variable,
      $.special_variable,
      $.number,
      $.float,
      $.blob,
      $.string,
      $.interpolated_string,
      $.boolean,
      $.null,
      $.list_expression,
      $.dictionary_expression,
      $.lambda_expression,
      $.parenthesized_expression,
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression,
      $.call_expression,
      $.method_call_expression,
      $.member_expression,
      $.index_expression,
      $.slice_expression,
      $.block_expression,
    ),

    parenthesized_expression: $ => seq('(', repeat($.newline), $._expression, repeat($.newline), ')'),

    list_expression: $ => seq(
      '[',
      multilineCommaSep($, $._expression),
      ']',
    ),

    dictionary_expression: $ => seq(
      '{',
      multilineCommaSep($, $.dictionary_entry),
      '}',
    ),

    dictionary_entry: $ => seq(
      field('key', choice($.identifier, $.string, $.computed_key)),
      ':',
      field('value', $._expression),
    ),

    computed_key: $ => seq('[', $._expression, ']'),

    block_expression: $ => seq(
      '{',
      optional(field('body', $._body)),
      '}',
    ),

    lambda_expression: $ => prec.right(seq(
      field('parameters', $.parameters),
      '=>',
      field('body', choice($._expression, $.block_expression)),
    )),

    call_expression: $ => prec.left(PREC.CALL, seq(
      field('function', $._expression),
      field('arguments', $.arguments),
    )),

    arguments: $ => seq(
      '(',
      multilineCommaSep($, $._expression),
      ')',
    ),

    method_call_expression: $ => prec.left(PREC.CALL, seq(
      field('receiver', $._expression),
      '->',
      field('method', choice($.identifier, $.autoload_identifier)),
      field('arguments', $.arguments),
    )),

    member_expression: $ => prec.left(PREC.MEMBER, seq(
      field('object', $._expression),
      '.',
      field('property', $.identifier),
    )),

    index_expression: $ => prec.left(PREC.MEMBER, seq(
      field('object', $._expression),
      '[',
      field('index', $._expression),
      ']',
    )),

    slice_expression: $ => prec.left(PREC.MEMBER, seq(
      field('object', $._expression),
      '[',
      optional(field('start', $._expression)),
      ':',
      optional(field('end', $._expression)),
      ']',
    )),

    unary_expression: $ => prec.right(PREC.UNARY, seq(
      field('operator', choice('!', '-', '+')),
      field('argument', $._expression),
    )),

    binary_expression: $ => choice(
      binary($, PREC.COALESCE, '??'),
      binary($, PREC.OR, '||'),
      binary($, PREC.AND, '&&'),
      binary($, PREC.COMPARE, choice(
        'is', 'isnot',
        '>', '>=', '<', '<=',
        token(/(?:==|!=|=~|!~)[#?]?/),
      )),
      binary($, PREC.CONCAT, '..'),
      binary($, PREC.ADD, choice('+', '-')),
      binary($, PREC.MULTIPLY, choice('*', '/', '%')),
    ),

    ternary_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression),
    )),

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
    type_name: _ => /[A-Z][A-Za-z0-9_]*/,
    autoload_identifier: _ => /[A-Za-z_][A-Za-z0-9_]*(?:#[A-Za-z_][A-Za-z0-9_]*)+/,
    scoped_identifier: _ => /[abglstvw]:[A-Za-z_][A-Za-z0-9_]*/,
    option_variable: _ => /&(?:(?:[gl]):)?[A-Za-z_][A-Za-z0-9_]*/,
    environment_variable: _ => /\$[A-Za-z_][A-Za-z0-9_]*/,
    register_variable: _ => /@[A-Za-z0-9"*+\-.:/%#=]/,
    special_variable: _ => choice('this', 'super'),

    number: _ => token(choice(
      /0[xX][0-9A-Fa-f]+/,
      /0[bB][01]+/,
      /0[oO][0-7]+/,
      /[0-9]+/,
    )),

    float: _ => token(choice(
      /[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?/,
      /[0-9]+[eE][+-]?[0-9]+/,
    )),

    blob: _ => token(/0z(?:[0-9A-Fa-f]{2}(?:\.[0-9A-Fa-f]{2})*)?/),

    string: _ => token(choice(
      /"(?:[^"\\]|\\.)*"/,
      /'(?:[^']|'')*'/,
    )),

    interpolated_string: _ => token(choice(
      /\$"(?:[^"\\]|\\.)*"/,
      /\$'(?:[^']|'')*'/,
    )),

    regex_pattern: _ => token(choice(
      /\/(?:[^/\\]|\\.)*\//,
      /\?(?:[^?\\]|\\.)*\?/,
    )),

    boolean: _ => choice('true', 'false', 'v:true', 'v:false'),
    null: _ => choice(
      'null',
      'v:null',
      'v:none',
      'null_blob',
      'null_channel',
      'null_dict',
      'null_function',
      'null_job',
      'null_list',
      'null_object',
      'null_partial',
      'null_string',
    ),

    _type: $ => choice(
      $.primitive_type,
      $.type_name,
      $.generic_type,
      $.function_type,
    ),

    primitive_type: _ => choice(...PRIMITIVE_TYPES),

    generic_type: $ => seq(
      field('constructor', choice('list', 'dict', 'tuple')),
      '<',
      field('arguments', commaSep1($._type)),
      '>',
    ),

    function_type: $ => seq(
      'func',
      '(',
      optional(commaSep($._type)),
      ')',
      optional(seq(':', field('return_type', $._type))),
    ),
  },
});

function multilineCommaSep($, rule) {
  return optional(choice(
    repeat1($.newline),
    seq(
      repeat($.newline),
      rule,
      repeat(seq(
        repeat($.newline),
        ',',
        repeat($.newline),
        rule,
      )),
      optional(seq(repeat($.newline), ',')),
      repeat($.newline),
    ),
  ));
}

function binary($, precedence, operator) {
  return prec.left(precedence, seq(
    field('left', $._expression),
    field('operator', operator),
    field('right', $._expression),
  ));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
