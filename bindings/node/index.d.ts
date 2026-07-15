type BaseNode = {
  type: string;
  named: boolean;
};

type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

type NodeInfo =
  | (BaseNode & { subtypes: BaseNode[] })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode;
    });

type Language = {
  language: unknown;
  nodeTypeInfo?: NodeInfo[];
  highlightsQuery: string;
  localsQuery: string;
  tagsQuery: string;
  foldsQuery: string;
};

declare const language: Language;
export = language;
