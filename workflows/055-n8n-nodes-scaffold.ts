/**
 * 055-n8n-nodes-scaffold.ts
 *
 * Build n8n-nodes-relayfile — custom n8n community nodes for relayfile.
 * Brings relayfile into n8n's workflow editor as native nodes.
 *
 * Nodes:
 * - Relayfile Trigger: watch workspace for file changes → start workflow
 * - Relayfile Action: read/write/query/bulk-write files in a workspace
 * - Relayfile Ops: list operations, get operation status
 *
 * n8n community nodes docs: https://docs.n8n.io/integrations/creating-nodes/
 * Package structure: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/
 *
 * Run: agent-relay run workflows/055-n8n-nodes-scaffold.ts
 */

import { workflow } from '@agent-relay/sdk/workflows';

const ROOT = '/Users/khaliqgant/Projects/AgentWorkforce/n8n-nodes-relayfile';
const SDK_ROOT = '/Users/khaliqgant/Projects/AgentWorkforce-relayfile';

async function main() {
  const result = await workflow('n8n-nodes-scaffold')
    .description('Build n8n-nodes-relayfile — custom n8n nodes for relayfile workspaces')
    .pattern('linear')
    .channel('wf-n8n-nodes')
    .maxConcurrency(2)
    .timeout(2_400_000)

    .agent('architect', { cli: 'claude', role: 'Designs the n8n nodes' })
    .agent('builder', { cli: 'codex', preset: 'worker', role: 'Implements the nodes' })
    .agent('reviewer', { cli: 'claude', role: 'Reviews n8n node conventions' })

    .step('design', {
      agent: 'architect',
      task: `Design n8n-nodes-relayfile — custom n8n community nodes.

Read the relayfile SDK client for available operations:
- ${SDK_ROOT}/packages/sdk/typescript/src/client.ts — RelayFileClient methods
- ${SDK_ROOT}/packages/sdk/typescript/src/types.ts — all input/output types

n8n community node requirements:
- Package name: n8n-nodes-relayfile
- Must follow n8n node structure (INodeType, INodeTypeDescription)
- Credential type for relayfile (baseUrl + accessToken)
- Published to npm, installable via n8n community nodes UI

Design these nodes:

1. **RelayfileTrigger** (trigger node):
   - Polls relayfile workspace for new events via getEvents()
   - Configurable: workspace ID, event types filter, poll interval
   - Outputs: event data (eventId, type, path, revision, timestamp)
   - Use case: "When a file changes in relayfile → run review workflow"

2. **Relayfile** (action node):
   - Operations:
     a. Read File: readFile(workspaceId, path)
     b. Write File: writeFile(workspaceId, input)
     c. Query Files: queryFiles(workspaceId, options)
     d. List Tree: listTree(workspaceId, options)
     e. Bulk Write: bulkWrite(workspaceId, files)
     f. Get Events: getEvents(workspaceId, options)
     g. Export Workspace: exportWorkspace(options)
   - Each operation maps 1:1 to a RelayFileClient method
   - Input: operation-specific fields from n8n UI
   - Output: API response as n8n items

3. **RelayfileOps** (action node):
   - Operations:
     a. List Operations: listOps(workspaceId, options)
     b. Get Operation: getOp(workspaceId, opId)
     c. Replay Operation: replayOp(workspaceId, opId)
   - For monitoring writeback pipeline status

4. **RelayfileCredentials** (credential type):
   - Fields: Base URL, Access Token
   - Test: call health endpoint to verify

File structure:
  credentials/RelayfileApi.credentials.ts
  nodes/Relayfile/Relayfile.node.ts
  nodes/Relayfile/RelayfileTrigger.node.ts
  nodes/Relayfile/RelayfileOps.node.ts
  nodes/Relayfile/relayfile.svg (icon)

Output: node descriptions, operations list, credential schema.
Keep under 80 lines. End with DESIGN_COMPLETE.`,
      verification: { type: 'output_contains', value: 'DESIGN_COMPLETE' },
      timeout: 300_000,
    })

    .step('implement', {
      agent: 'builder',
      dependsOn: ['design'],
      task: `Implement n8n-nodes-relayfile.

Design: {{steps.design.output}}

Working in ${ROOT}.

1. **Package setup** following n8n community node conventions:
   - package.json with:
     "n8n": { "n8nNodesPackageName": "n8n-nodes-relayfile" }
     "nodes": ["dist/nodes/Relayfile/Relayfile.node.js", ...]
     "credentials": ["dist/credentials/RelayfileApi.credentials.js"]
   - tsconfig.json targeting ES2020, module commonjs (n8n requirement)
   - Dependencies: n8n-workflow (peer), @relayfile/sdk

2. **RelayfileApi.credentials.ts**:
   - ICredentialType with fields: baseUrl (string), accessToken (string)
   - Test: GET {baseUrl}/health with Bearer token

3. **Relayfile.node.ts** (main action node):
   - INodeType with resource + operation pattern
   - Each operation calls the corresponding RelayFileClient method
   - Map n8n input items to SDK input types
   - Map SDK responses back to n8n output items
   - Handle errors with NodeApiError

4. **RelayfileTrigger.node.ts**:
   - INodeType (trigger) using polling
   - Track last event cursor in workflow static data
   - Output new events as n8n items

5. **RelayfileOps.node.ts**:
   - Operations for writeback pipeline monitoring

6. **relayfile.svg** — simple icon (can be a placeholder)

7. **README.md** with installation + usage

8. Build: npx tsc
9. Commit on feat/scaffold + push

End with IMPLEMENT_COMPLETE.`,
      verification: { type: 'output_contains', value: 'IMPLEMENT_COMPLETE' },
      timeout: 900_000,
    })

    .step('review', {
      agent: 'reviewer',
      dependsOn: ['implement'],
      task: `Review n8n-nodes-relayfile in ${ROOT}.

Verify:
1. Follows n8n community node conventions (package.json n8n field, node structure)
2. Credential type has test connection
3. All RelayFileClient operations covered in action node
4. Trigger node uses polling with cursor tracking
5. Error handling uses NodeApiError
6. Types are clean — INodeExecutionData properly formed
7. README has installation + each node documented

Fix issues. Keep under 50 lines. End with REVIEW_COMPLETE.`,
      verification: { type: 'output_contains', value: 'REVIEW_COMPLETE' },
      timeout: 300_000,
    })

    .onError('retry', { maxRetries: 1, retryDelayMs: 10_000 })
    .run({ cwd: ROOT });

  console.log('n8n nodes complete:', result.status);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
