(function_definition) @local.scope
(lambda_expression) @local.scope
(class_definition) @local.scope
(interface_definition) @local.scope

(parameter
  name: (identifier) @local.definition)

(parameter
  name: (member_lvalue
    property: (identifier) @local.definition))

(variable_declaration
  pattern: (identifier) @local.definition)

(list_pattern
  (identifier) @local.definition)

(type_alias_statement
  name: (type_name) @local.definition)

(function_definition
  name: [(identifier) (scoped_identifier) (autoload_identifier)] @local.definition)

(identifier) @local.reference
(scoped_identifier) @local.reference
(autoload_identifier) @local.reference
