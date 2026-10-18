# n8n-nodes-nectain

n8n community nodes for the Nectain REST API.

## Requirements

- A Nectain installation with the REST API enabled.
- A Nectain API key with the `rest` scope.
  A user creates a key in **My API Keys** of the user menu;
  a supervisor creates the keys of dedicated integration users.
  Requests run with the rights of the user who owns the key.

## Installation

In n8n, open **Settings** → **Community nodes**, select **Install**,
and enter `n8n-nodes-nectain`.
See the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
for self-hosted and queue mode setups.

## Credentials

The **Nectain API** credential has two fields:

- **Base URL**: the address of the Nectain installation, such as `https://nectain.example.com`.
- **API Key**: a key with the `rest` scope, created as described in [Requirements](#requirements).

n8n tests the credential by listing the document types.
A revoked or expired key, or a key without the `rest` scope, fails the test with `403` and the code `forbidden`.

## Operations

A document type or a recognition template is chosen from a list, by code, or by ID.
**Get** operations, and **Get Many** and **Get Descendants** of recognition jobs,
offer a **Fields** option, sent as the `select` query parameter:
see *Selecting fields* in the API reference that the installation publishes at `/api-docs/`.
A failed request fails the item with the `code` of the server's error,
or outputs it as `error` when the node's **On Error** setting continues.

### Document

- **Create**: a document of a chosen type with a title, a repository folder, attribute values, and participants.
  With an **Input Binary Field**, the file of that field becomes the primary file,
  sent with the metadata in one request.
  **Attributes Input** maps the attributes of the document type one by one,
  or takes the `attributes` object of the API as JSON, which also sets a hyperlink with its own caption.
  A mapped reference is sent by ID when its value is a number and by code otherwise;
  multiple references are a comma-separated list of such values.
  A participant is a role and a person by login name or an organization unit by code.
- **Get**: a document by ID.
- **Download File**: the primary file of a document as binary data.
- **Replace File**: the primary file of a document, from an input binary field.

### Document type

- **Get**: a document type with its attributes, participant roles, and states.
- **Get Many**: the document types, filtered by **Only Creatable** and by a repository **Folder**.

### Recognition job

- **Start**: the recognition of the file of an input binary field with a recognition template.
  Each input item starts its own job.
  **Auto Create Document** creates the document after a successful recognition;
  when it is off, the result holds the extracted data.
- **Get**: a job by ID.
- **Get Many**: the jobs, filtered by **Status**, **Is Group**, **Is Multi-Document**, and **Template**,
  with **Return All** or a **Limit**.
- **Get Descendants**: the child jobs of a job and their children, with the same filters.
- **Get Result**: the created document or the extracted data of a job.
- **Download File**: the file of a job as binary data.

**Wait for Completion**, off by default, makes **Start** read the job every 5 seconds
until its status is `success`, `error`, `completedWithErrors`, `canceled`, or `hanging`,
and output the final job.
A job that ends with `success` or `error` and is neither a group nor multi-document also gets its `result`.
When the **Timeout**, 10 minutes by default, passes first, the item fails with the ID of the job,
which **Get** reads later.
The execution stays busy while it waits.

### Recognition template

- **Get Many**: the recognition templates.

An installation without recognition support answers `404` to the recognition operations,
and the template list of **Start** is empty.

### Files and retries

By default, the server accepts a file of up to 24 MiB and a request with a file of up to 32 MiB;
an installation can change both limits.
A larger file or request fails the item with `413` and the code `payload_too_large`.
The node holds the whole file in memory while it sends or receives it.

**Create** of a document and **Start** of a recognition take an optional **Idempotency Key**.
A repeated execution with the same key and the same parameters returns the result of the first request
instead of creating a second document or job;
the same key with other parameters fails with `idempotency_key_reused`.
See *Safe retries* in the API reference for how long the server keeps a result.

## Development

Requires the current Node.js LTS.

```sh
npm install
npm run dev            # start n8n on http://localhost:5678 with these nodes linked, rebuild on change
npm run lint           # n8n community node rules, then neostandard and project rules
npm run lint:fix       # fix what both can fix
npm run typecheck      # type-check sources and tests
npm test               # unit tests
npm run test:coverage  # unit tests with a coverage report in coverage/
npm run build          # compile to dist/
```

`npm run dev` sets environment variables that turn off the calls n8n makes to its own services:
telemetry, version and news notices, templates, banners,
the list of verified community nodes, and the MCP server registry.
It still downloads the latest n8n from npm at each start.
The variables use POSIX shell syntax, so the script needs a POSIX shell.
If an n8n release drops the `mcp-registry` module, n8n stops at start with an unknown module error:
remove `N8N_DISABLED_MODULES` from the script then.

The nodes and credentials of the package are registered in the `n8n` section of `package.json`.

`eslint.config.mjs` must stay the n8n default:
in strict mode, `n8n-node lint` rejects a changed file, and the package loses n8n Cloud eligibility.
Code style and other project rules are in `eslint.project.config.mjs`.
Unit tests are `test/**/*.test.cts`, because the n8n rules apply to `.ts` files
and reject the Node.js imports that tests need.

ESLint stays on 9, because the n8n lint rules fail on ESLint 10.
TypeScript stays on 6.0, because `typescript-eslint` does not support a later version.

## Release

`npm run release` lints and builds the package, bumps the version,
generates `CHANGELOG.md` from commit messages, then commits, tags and pushes.
The tag starts `.github/workflows/publish.yml`,
which publishes the package to npm with a provenance statement, as n8n Cloud verification requires.
The workflow header describes the one-time npm setup.

## License

[MIT](LICENSE)
