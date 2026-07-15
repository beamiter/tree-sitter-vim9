(comment) @comment

(string) @string
(interpolated_string) @string.special
(regex_pattern) @string.regexp

(number) @number
(float) @number.float
(blob) @number
(boolean) @boolean
(null) @constant.builtin

(function_definition
  name: [(identifier) (scoped_identifier) (autoload_identifier)] @function)

(abstract_method_declaration
  name: (identifier) @function.method)

(interface_method_declaration
  name: (identifier) @function.method)

(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (autoload_identifier) @function.call)

(call_expression
  function: (member_expression
    property: (identifier) @function.method.call))

(method_call_expression
  method: [(identifier) (autoload_identifier)] @function.method.call)

(parameter
  name: (identifier) @variable.parameter)

(parameter
  name: (member_lvalue
    property: (identifier) @property))

(variable_declaration
  pattern: (identifier) @variable)

(type_alias_statement
  name: (type_name) @type.definition)

(class_definition
  name: (type_name) @type.definition)

(interface_definition
  name: (type_name) @type.definition)

(enum_definition
  name: (type_name) @type.definition)

(type_name) @type
(primitive_type) @type.builtin
(generic_type constructor: ["list" "dict" "tuple"] @type.builtin)

(member_expression
  property: (identifier) @property)

(member_lvalue
  property: (identifier) @property)

(dictionary_entry
  key: (identifier) @property)

(enum_value
  name: (identifier) @constant)

(scoped_identifier) @variable.builtin
(option_variable) @variable.builtin
(environment_variable) @variable.builtin
(register_variable) @variable.builtin
(special_variable) @variable.builtin
(autoload_identifier) @variable
(identifier) @variable
(command_name) @function.macro

[
  "vim9script"
  "import"
  "autoload"
  "as"
  "export"
  "type"
  "var"
  "final"
  "const"
  "def"
  "enddef"
  "abstract"
  "public"
  "static"
  "if"
  "elseif"
  "else"
  "endif"
  "for"
  "in"
  "endfor"
  "while"
  "endwhile"
  "try"
  "catch"
  "finally"
  "endtry"
  "class"
  "extends"
  "implements"
  "endclass"
  "interface"
  "endinterface"
  "enum"
  "endenum"
  "return"
  (break_statement)
  (continue_statement)
  (finish_statement)
  "throw"
  "defer"
] @keyword

[
  "echo"
  "echomsg"
  "echoerr"
  "echowindow"
  "execute"
  "eval"
  "call"
] @function.builtin

[
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "..="
  "&&="
  "||="
  "??="
  "??"
  "||"
  "&&"
  "is"
  "isnot"
  ">"
  ">="
  "<"
  "<="
  ".."
  "+"
  "-"
  "*"
  "/"
  "%"
  "!"
  "?"
  "->"
] @operator

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ":" ";" "." "|"] @punctuation.delimiter
