# Cognigy Extension Development Guide

Reference for building custom Cognigy.AI v4 Extensions using `@cognigy/extension-tools@0.17.0`.

---

## Overview

A Cognigy Extension is a TypeScript/JavaScript package that adds custom **Flow Nodes** and/or **Knowledge Connectors** to Cognigy.AI. Extensions are uploaded as `.tar.gz` archives and installed via **Manage > Extensions** in the Cognigy.AI UI.

### What Extensions Can Do

- Integrate third-party APIs (REST, databases, SaaS)
- Add custom logic and convenience nodes
- Import external data as Knowledge Sources for RAG

### Limitations

| Constraint | Detail |
|---|---|
| Default timeout | 20 seconds |
| API calls per execution | Max 10 (excluding `api.log()`) |
| Object argument size | Max 62 KB |
| Runtime cleanup | After 15 min of inactivity |
| Filesystem | Read-only -- no `fs.writeFile()` or `fs.mkdir()` |
| Child processes | `child_process.spawn`/`exec` are not allowed |
| Dynamic npm installs | Not possible at runtime |
| Private network | Cannot connect to private IP ranges |

---

## Project Structure

```
extension-name/
  README.md
  icon.png              (64x64 pixels, required)
  package.json
  package-lock.json
  tsconfig.json
  src/
    module.ts           (entry point -- exports createExtension)
    connections/
      myConnection.ts
    nodes/
      myNode.ts
    knowledge-connectors/   (optional)
      myConnector.ts
```

---

## package.json

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My custom Cognigy Extension",
  "main": "build/module.js",
  "scripts": {
    "transpile": "tsc -p .",
    "zip": "tar cfz extension.tar.gz build/* package.json package-lock.json README.md icon.png",
    "build": "npm run transpile && npm run zip"
  },
  "dependencies": {
    "@cognigy/extension-tools": "0.17.0"
  },
  "devDependencies": {
    "@types/node": "^22.18.5",
    "typescript": "^5.9.2"
  }
}
```

> Strip dev dependencies before packaging: `npm ci --omit=dev` then `npm run build`.

---

## tsconfig.json

```json
{
  "compileOnSave": true,
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "target": "es2017",
    "module": "commonjs",
    "rootDir": "src",
    "outDir": "build",
    "sourceMap": true,
    "strict": false,
    "moduleResolution": "node"
  }
}
```

---

## Entry Point: module.ts

The entry point imports all nodes, connections, and knowledge connectors, then exports the extension via `createExtension()`.

```ts
import { createExtension } from "@cognigy/extension-tools";
import { apiKeyConnection } from "./connections/apiKeyConnection";
import { myNode } from "./nodes/myNode";

export default createExtension({
  nodes: [myNode],
  connections: [apiKeyConnection],
  knowledge: [],  // optional
});
```

### createExtension Parameters

```ts
interface ICreateExtensionParams {
  nodes: INodeDescriptor[];
  connections?: IConnectionSchema[];
  knowledge?: IKnowledgeConnector[];
  options?: IExtensionOptions;
}
```

---

## Connections

Connections define credential schemas. Users fill them in via the Cognigy UI, and the values are securely stored and injected at runtime.

```ts
import type { IConnectionSchema } from "@cognigy/extension-tools";

export const apiKeyConnection: IConnectionSchema = {
  type: "api-key",            // unique identifier, referenced by nodes
  label: "API Key Connection",
  fields: [
    { fieldName: "key" },
    { fieldName: "secret" },  // add as many fields as needed
  ],
};
```

### IConnectionSchema

| Property | Type | Description |
|---|---|---|
| `type` | string | Unique connection type identifier. Referenced by node fields with `params.connectionType`. |
| `label` | string | Human-readable description shown in the UI. |
| `fields` | `IConnectionSchemaField[]` | List of credential fields the user must provide. |

### IConnectionSchemaField

| Property | Type | Description |
|---|---|---|
| `fieldName` | string | The field name, e.g. `"client_id"`, `"password"`. |

---

## Flow Nodes

Nodes are the building blocks of Cognigy Flows. Each node is created with `createNodeDescriptor()`.

### Minimal Node

```ts
import { createNodeDescriptor, type INodeFunctionBaseParams } from "@cognigy/extension-tools";

export interface IMyNodeParams extends INodeFunctionBaseParams {
  config: {
    text: string;
  };
}

export const myNode = createNodeDescriptor({
  type: "myNode",
  defaultLabel: "My Node",
  fields: [
    {
      key: "text",
      label: "Text input",
      type: "cognigyText",
      defaultValue: "{{input.text}}",
    },
  ],
  function: async ({ cognigy, config }: IMyNodeParams) => {
    const { api } = cognigy;
    const { text } = config;
    api.say(`You said: ${text}`);
  },
});
```

### INodeDescriptor (Full Interface)

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Unique node type identifier, e.g. `"myNode"`. |
| `defaultLabel` | string \| INodeFieldTranslations | Yes | Default label when a new node is created. |
| `summary` | string \| INodeFieldTranslations | No | Short description of the node's purpose. |
| `parentType` | string \| string[] | No | Type of the parent node (for child nodes). |
| `fields` | INodeField[] | No | Input fields for the node configuration. |
| `sections` | IFormSection[] | No | Collapsible groups for organizing fields. |
| `form` | IFormFieldAndSectionFormElement[] | No | Rendering order of fields and sections. |
| `function` | TNodeFunction | No | The async function executed at runtime. |
| `preview` | INodePreview | No | Configures the preview line shown on the node. |
| `appearance` | INodeAppearance | No | Color and variant customization. |
| `behavior` | INodeBehavior | No | Additional behavioral flags. |
| `constraints` | INodeConstraints | No | Rules for creation, editing, placement. |
| `dependencies` | INodeDependencies | No | Auto-created child nodes. |
| `tokens` | ISnippet[] | No | Cognigy Tokens introduced by this node. |
| `tags` | string[] | No | Categorization: `"basic"`, `"logic"`, `"message"`, `"profile"`, `"service"`, `"nlu"`, `"data"`. |

---

## Node Fields (INodeField)

Each field defines one input in the node editor UI.

| Property | Type | Required | Description |
|---|---|---|---|
| `key` | string | Yes | Unique field identifier within the node. |
| `label` | string \| INodeFieldTranslations | Yes | Label shown above the field. |
| `type` | TNodeFieldType | Yes | The field type (see table below). |
| `defaultValue` | any | No | Default value for this field. |
| `description` | string \| INodeFieldTranslations | No | Help text shown below the field. |
| `params` | object | No | Type-specific parameters (see below). |
| `condition` | TNodeFieldCondition | No | Show/hide condition based on other fields. |
| `optionsResolver` | INodeOptionsResolver | No | Dynamic options for `select` fields. |

### Field Types

| Type | Value Type | Description | Params |
|---|---|---|---|
| `cognigyText` | string | Text with CognigyScript support (`{{input.text}}`) | `disabled`, `placeholder`, `required` |
| `text` | string | Plain text input | `required` |
| `textArray` | string[] | Array of text inputs | `required` |
| `chipInput` | string[] | Tag/chip input (press Enter to add) | -- |
| `number` | number | Numeric input | `min`, `max` |
| `slider` | number | Numeric slider | `min`, `max`, `step` |
| `checkbox` | boolean | Checkbox | -- |
| `toggle` | boolean | Toggle switch | -- |
| `select` | string | Dropdown select | `options: [{label, value}]` |
| `date` | string | Date picker | `locale` (moment.js) |
| `datetime` | string | Date + time picker | `locale` |
| `daterange` | string | Date range picker | `locale` |
| `time` | string | Time picker | `locale` |
| `json` | object | JSON code editor | -- |
| `xml` | string | XML code editor | -- |
| `say` | object | Full Cognigy Say control | -- |
| `connection` | object | Connection selector | `connectionType` (must match `IConnectionSchema.type`) |
| `adaptivecard` | object | Adaptive Card editor with preview | -- |
| `backgroundSelector` | string | Background image selector | -- |
| `rule` | object | Rule/condition builder | -- |
| `condition` | string | Condition field | -- |
| `description` | string | Static description text | -- |
| `typescript` | string | TypeScript code editor | -- |

---

## Sections and Form Layout

Fields can be grouped into collapsible sections.

### IFormSection

| Property | Type | Required | Description |
|---|---|---|---|
| `key` | string | Yes | Unique section identifier. |
| `label` | string \| INodeFieldTranslations | Yes | Section heading text. |
| `description` | string \| INodeFieldTranslations | No | Section help text. |
| `defaultCollapsed` | boolean | Yes | Whether the section starts collapsed. |
| `fields` | string[] | Yes | Array of field `key` values grouped in this section. |
| `condition` | TNodeFieldCondition | No | Show/hide condition. |

### Form Ordering

When using sections, define a `form` array to control rendering order:

```ts
form: [
  { type: "field", key: "topLevelField" },
  { type: "section", key: "section1" },
  { type: "section", key: "section2" },
]
```

Each element is `{ key: string, type: "field" | "section" }`.

---

## Conditional Fields and Sections

Fields and sections can be conditionally shown/hidden based on other field values.

### Simple Condition

```ts
condition: { key: "checkbox", value: true }
```

### Negation

```ts
condition: { key: "checkbox", value: true, negate: true }
```

### AND

```ts
condition: {
  and: [
    { key: "field1", value: true },
    { key: "field2", value: "option1" }
  ]
}
```

### OR

```ts
condition: {
  or: [
    { key: "field1", value: true },
    { key: "field2", value: true }
  ]
}
```

### Multi-Value Match

```ts
condition: { key: "field1", value: ["option1", "option2"] }
```

### Nested Operators

```ts
condition: {
  or: [
    { and: [{ key: "field1", value: true }, { key: "field2", value: true }] },
    { key: "field3", value: true }
  ]
}
```

---

## Node Appearance

Customize how the node looks in the Flow Editor.

### INodeAppearance

| Property | Type | Description |
|---|---|---|
| `color` | string | Background color (hex), e.g. `"#FFAABB"`. |
| `textColor` | string | Text color (hex). |
| `contrastTextColor` | string | Contrast text color. |
| `showIcon` | boolean | Whether to show the extension icon. |
| `variant` | `"regular"` \| `"mini"` \| `"hexagon"` | Node shape variant. |

### Node Preview

Show a preview of a field value on the node:

```ts
preview: { type: "text", key: "fieldKey" }
```

| Property | Type | Description |
|---|---|---|
| `type` | `"text"` \| `"image"` \| `"custom"` \| `"aiAgent"` | Preview type. |
| `key` | string | Field key to preview. |

---

## Node Constraints

Control how the node can be manipulated in the editor.

### INodeConstraints

| Property | Type | Description |
|---|---|---|
| `editable` | boolean | Can the node be edited? |
| `deletable` | boolean | Can the node be deleted? |
| `creatable` | boolean | Can the node be manually created? |
| `collapsable` | boolean | Can the node be collapsed? |
| `movable` | boolean | Can the node be moved? |
| `childFlowCreatable` | boolean | Can a child Flow be created from this node? |
| `placement.predecessor` | `{ whitelist?, blacklist? }` | Allowed/blocked predecessor node types. |
| `placement.successor` | `{ whitelist?, blacklist? }` | Allowed/blocked successor node types. |
| `placement.children` | `{ whitelist?, blacklist? }` | Allowed/blocked child node types. |

---

## Child Nodes (Branching)

Nodes can have child nodes for branching logic (like If/Lookup nodes).

### Parent Node

```ts
export const parentNode = createNodeDescriptor({
  type: "parentNode",
  defaultLabel: "Pick Path",
  dependencies: {
    children: ["childLeft", "childRight"],  // auto-created on node creation
  },
  constraints: {
    placement: {
      children: { whitelist: ["childLeft", "childRight"] },
    },
  },
  function: async ({ cognigy, childConfigs }) => {
    const child = childConfigs.find((c) => c.type === "childLeft");
    if (child) cognigy.api.setNextNode(child.id);
  },
});
```

### Child Node

```ts
export const childLeft = createNodeDescriptor({
  type: "childLeft",
  parentType: "parentNode",
  defaultLabel: "Left",
  appearance: { color: "#2ecc71", textColor: "black", variant: "mini" },
  constraints: {
    editable: false,
    deletable: true,
    collapsable: true,
    creatable: true,
    movable: false,
    placement: { predecessor: { whitelist: [] } },
  },
});
```

---

## Tokens

Nodes can introduce Cognigy Tokens that let users reference node output in CognigyScript editors:

```ts
tokens: [
  {
    type: "context",      // "context" | "input" | "profile"
    label: "API Result",
    script: "context.apiResult",
  },
]
```

---

## Node Function API

The `function` receives `{ cognigy, config, childConfigs, nodeId }`.

### cognigy Object

| Property | Type | Description |
|---|---|---|
| `api` | INodeExecutionAPI | The main API for interacting with the Flow. |
| `input` | object | The current user input object. |
| `context` | object | The conversation context (read/write). |
| `profile` | object | The user's contact profile. |

### Key API Methods

| Method | Description |
|---|---|
| `api.say(text, data?)` | Send a message to the user. |
| `api.output(text, data?)` | Same as `say`. |
| `api.addToContext(key, value, mode)` | Write to context. `mode`: `"simple"` (overwrite) or `"array"` (append). |
| `api.addToInput(key, value)` | Write to the input object. |
| `api.getContext(key)` | Read from context. |
| `api.deleteContext(key)` | Remove a context entry. |
| `api.removeFromContext(key, value, mode)` | Remove from context. |
| `api.resetContext()` | Reset context to Flow defaults. |
| `api.setNextNode(nodeId, flowId?)` | Set the next node to execute (for branching). |
| `api.log(level, message)` | Write to execution logs. Levels: `"fatal"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`. |
| `api.setState(state)` | Set conversation state. |
| `api.getState()` | Get current state. |
| `api.resetState()` | Reset to default state. |
| `api.stopExecution()` | Stop processing after this node. |
| `api.completeGoal(goal)` | Mark a goal as completed. |
| `api.updateProfile(key, value)` | Update a contact profile field. |
| `api.activateProfile()` | Activate the user's contact profile. |
| `api.deactivateProfile(deleteData)` | Deactivate profile. If `true`, erases data. |
| `api.mergeProfile(contactId)` | Merge with another contact profile. |
| `api.executeFlow(config)` | Execute another Flow in-place. |
| `api.setAppState(templateId, data)` | Update xApp session state. |
| `api.evaluateRule(rule)` | Evaluate a rule condition. Returns `boolean`. |
| `api.parseCognigyScriptText(text)` | Resolve CognigyScript expressions in text. |
| `api.parseCognigyScriptCondition(cond)` | Evaluate a CognigyScript condition. |
| `api.thinkV2(text, data)` | Restart Flow execution with simulated input. |
| `api.emitToOpsCenter({ title })` | Forward an error to AI Ops Center. |
| `api.getExecutionAmount(nodeId)` | Get how many times a node was executed in this conversation. |
| `api.resetExecutionAmount(nodeId)` | Reset execution count to 0. |
| `api.setSensitiveLoggingSettings(settings)` | Update masking/redaction settings. |

---

## Knowledge Connectors

Knowledge Connectors import external data into Cognigy Knowledge Stores for RAG.

```ts
import * as crypto from "node:crypto";
import { createKnowledgeConnector } from "@cognigy/extension-tools";

export const myConnector = createKnowledgeConnector({
  type: "myConnector",
  label: "My Connector",
  summary: "Imports data from external source",
  fields: [
    {
      key: "name",
      label: "Source Name",
      type: "text",
      params: { required: true },
    },
  ] as const,   // "as const" enables type-safe config access in function
  function: async ({ config, api, sources }) => {
    const contentHash = crypto.hash("sha256", config.name, "hex");

    const source = await api.upsertKnowledgeSource({
      name: config.name,
      description: "My source",
      tags: ["example"],
      chunkCount: 1,
      contentHashOrTimestamp: contentHash,
    });

    if (source) {
      await api.createKnowledgeChunk({
        knowledgeSourceId: source.knowledgeSourceId,
        text: "Some knowledge text",
        data: { type: "example" },
      });
    }

    // Clean up deleted sources
    for (const s of sources) {
      if (s.externalIdentifier !== config.name) {
        await api.deleteKnowledgeSource({
          knowledgeSourceId: s.knowledgeSourceId,
        });
      }
    }
  },
});
```

### Knowledge API Methods

| Method | Description |
|---|---|
| `api.createKnowledgeSource(params)` | Create a new Knowledge Source. |
| `api.upsertKnowledgeSource(params)` | Create or update a Knowledge Source. Returns `null` if no re-ingestion needed. |
| `api.deleteKnowledgeSource({ knowledgeSourceId })` | Delete a Knowledge Source. |
| `api.createKnowledgeChunk(params)` | Add a chunk to a Knowledge Source. |

### Knowledge Function Parameters

| Parameter | Type | Description |
|---|---|---|
| `config` | object | Type-safe config values from defined fields. |
| `api` | KnowledgeApi | Knowledge API methods. |
| `sources` | KnowledgeSource[] | Existing sources from previous runs by this connector. |

---

## Option Resolvers (Dynamic Select Fields)

Dynamically load options for `select` fields from external APIs.

```ts
{
  key: "file",
  type: "select",
  label: "Select a file",
  optionsResolver: {
    dependencies: ["connection"],
    resolverFunction: async ({ api, config }) => {
      const response = await api.httpRequest({
        method: "GET",
        url: "https://example.service/files",
        headers: { xApiKey: config.connection.apiKey },
      });
      return response.data.map((file) => ({
        label: file.name,
        value: file.id,
      }));
    },
  },
}
```

The `resolverFunction` is triggered whenever a dependency field value changes. It must return `{ label: string, value: string }[]`.

---

## Localization

Node labels, summaries, field labels, field descriptions, section labels, and select option labels can be localized.

Replace any string with a translations object:

```ts
defaultLabel: {
  default: "My Node",       // mandatory fallback
  deDE: "Mein Knoten",
  enUS: "My Node",
  esES: "Mi Nodo",
  jaJP: "マイノード",
  koKR: "내 노드",
}
```

### Supported Locales

| Key | Language |
|---|---|
| `default` | Fallback (mandatory) |
| `enUS` | English |
| `deDE` | German |
| `esES` | Spanish |
| `jaJP` | Japanese |
| `koKR` | Korean |

---

## Build & Upload

1. Install dependencies: `npm install`
2. Build: `npm run build` (transpiles TypeScript and creates `.tar.gz`)
3. Upload: **Manage > Extensions** in Cognigy.AI UI, upload the `.tar.gz` file

### Build Output

The build produces:
- `build/` -- compiled JavaScript
- `extension.tar.gz` -- archive containing `build/*`, `package.json`, `package-lock.json`, `README.md`, `icon.png`

---

## Best Practices

| Practice | Detail |
|---|---|
| Keep extensions lean | Strip dev dependencies before packaging. |
| Stay under API call limits | Max 10 calls per execution (excluding `api.log()`). |
| Use module-level singletons | Initialize HTTP clients/DB connections at top level for reuse. |
| Scope execution data | Never store per-execution data at module level -- use the node function scope. |
| Handle errors explicitly | Wrap async calls in `try/catch`; log via `api.log()`. |
| In-memory temp data only | Filesystem is read-only. Use variables for temp data. |
| Persist externally | Module-level data is lost after 15 min inactivity. Use external storage. |
| Validate payload sizes | Check before passing large payloads (62 KB limit). |
| Keep nodes few | Fewer than 20 nodes per extension. |

---

## Error Handling Pattern

```ts
function: async ({ cognigy, config }) => {
  const { api } = cognigy;
  try {
    const result = await fetch(config.url);
    const data = await result.json();
    api.addToContext("result", data, "simple");
  } catch (error) {
    api.log("error", `Request failed: ${error.message}`);
    api.addToContext("result", { error: error.message }, "simple");
  }
}
```

Unhandled exceptions don't crash the runtime, but the Flow receives an error in `input.extensionError` and counts against the timeout.

---

## Node with Connection Example

```ts
import { createNodeDescriptor, type INodeFunctionBaseParams } from "@cognigy/extension-tools";

export interface IApiRequestParams extends INodeFunctionBaseParams {
  config: {
    connection: { key: string };
    path: string;
  };
}

export const apiRequest = createNodeDescriptor({
  type: "apiRequest",
  defaultLabel: "API Request",
  fields: [
    {
      key: "connection",
      label: "API Connection",
      type: "connection",
      params: { connectionType: "api-key" },   // must match IConnectionSchema.type
    },
    {
      key: "path",
      label: "API Path",
      type: "cognigyText",
      defaultValue: "https://api.example.com/data",
    },
  ],
  function: async ({ cognigy, config }: IApiRequestParams) => {
    const { api } = cognigy;
    const { path, connection } = config;

    try {
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${connection.key}` },
      });
      const data = await res.json();
      api.addToContext("apiResponse", data, "simple");
      api.say("API response stored in context.");
    } catch (err) {
      api.log("error", `API call failed: ${err}`);
      api.say("API request failed.");
    }
  },
});
```
