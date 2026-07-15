(function_definition
  name: [(identifier) (scoped_identifier) (autoload_identifier)] @name) @definition.function

(class_definition
  name: (type_name) @name) @definition.class

(interface_definition
  name: (type_name) @name) @definition.interface

(enum_definition
  name: (type_name) @name) @definition.type

(type_alias_statement
  name: (type_name) @name) @definition.type

(variable_declaration
  pattern: (identifier) @name) @definition.variable

(call_expression
  function: (identifier) @name) @reference.call

(call_expression
  function: (autoload_identifier) @name) @reference.call

(method_call_expression
  method: [(identifier) (autoload_identifier)] @name) @reference.call
