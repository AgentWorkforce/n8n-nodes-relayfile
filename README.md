# n8n-nodes-relayfile

RelayFile community nodes for n8n.

## Installation

Install from the n8n Community Nodes UI with `n8n-nodes-relayfile`, or add it to a self-hosted n8n instance:

```bash
npm install n8n-nodes-relayfile
```

## Credentials

Create a `Relayfile API` credential with:

- `Base URL`: RelayFile API base URL, for example `https://api.relayfile.com`
- `Access Token`: RelayFile bearer token

The credential test calls `GET /health`.

## Nodes

### Relayfile Trigger

Polls a RelayFile workspace for new filesystem events and emits matching items.

Parameters:

- `Workspace ID`
- `Event Types`
- `Provider`
- `Limit`
- `Poll Interval (Minutes)`

Emitted fields include `eventId`, `type`, `path`, `revision`, `provider`, `correlationId`, `timestamp`, and `nextCursor`.

### Relayfile

Core filesystem action node with these operations:

- `Read File`
- `Write File`
- `Query Files`
- `List Tree`
- `Bulk Write`
- `Get Events`
- `Export Workspace`

Structured RelayFile inputs such as semantics, property filters, and bulk file lists are provided as JSON text fields.

### Relayfile Ops

Operation monitoring node for the writeback pipeline:

- `List Operations`
- `Get Operation`
- `Replay Operation`

## Development

```bash
npm install
npm run build
```
