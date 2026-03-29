import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	asNodeApiError,
	feedItems,
	getEventsOptions,
	getListTreeOptions,
	getOperationValue,
	getQueryFilesOptions,
	getRelayfileClient,
	getWorkspaceId,
	getWriteFileInput,
	parseBulkWriteFiles,
	toItems,
} from './GenericFunctions';

const operationProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		default: 'file',
		options: [
			{
				name: 'File',
				value: 'file',
			},
		],
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'readFile',
		options: [
			{ name: 'Read File', value: 'readFile', action: 'Read a file' },
			{ name: 'Write File', value: 'writeFile', action: 'Write a file' },
			{ name: 'Query Files', value: 'queryFiles', action: 'Query files' },
			{ name: 'List Tree', value: 'listTree', action: 'List a tree' },
			{ name: 'Bulk Write', value: 'bulkWrite', action: 'Bulk write files' },
			{ name: 'Get Events', value: 'getEvents', action: 'Get file events' },
			{ name: 'Export Workspace', value: 'exportWorkspace', action: 'Export a workspace' },
		],
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
	},
	{
		displayName: 'Workspace ID',
		name: 'workspaceId',
		type: 'string',
		default: '',
		required: true,
		description: 'RelayFile workspace identifier',
	},
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['readFile', 'writeFile'],
			},
		},
	},
	{
		displayName: 'Base Revision',
		name: 'baseRevision',
		type: 'string',
		default: '',
		required: true,
		description: 'Expected revision used for optimistic concurrency',
		displayOptions: {
			show: {
				operation: ['writeFile'],
			},
		},
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: {
			rows: 8,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['writeFile'],
			},
		},
	},
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'string',
		default: 'text/markdown',
		displayOptions: {
			show: {
				operation: ['writeFile'],
			},
		},
	},
	{
		displayName: 'Encoding',
		name: 'encoding',
		type: 'options',
		default: '',
		options: [
			{ name: 'Default', value: '' },
			{ name: 'UTF-8', value: 'utf-8' },
			{ name: 'Base64', value: 'base64' },
		],
		displayOptions: {
			show: {
				operation: ['writeFile'],
			},
		},
	},
	{
		displayName: 'Semantics JSON',
		name: 'semanticsJson',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		placeholder: '{"properties":{"owner":"agent"},"relations":["source:doc"]}',
		description: 'Optional RelayFile semantics object as JSON',
		displayOptions: {
			show: {
				operation: ['writeFile'],
			},
		},
	},
	{
		displayName: 'Query Path',
		name: 'queryPath',
		type: 'string',
		default: '',
		description: 'Optional path prefix filter',
		displayOptions: {
			show: {
				operation: ['queryFiles'],
			},
		},
	},
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'string',
		default: '',
		description: 'Optional provider filter',
		displayOptions: {
			show: {
				operation: ['queryFiles', 'getEvents'],
			},
		},
	},
	{
		displayName: 'Relation',
		name: 'relation',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['queryFiles'],
			},
		},
	},
	{
		displayName: 'Permission',
		name: 'permission',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['queryFiles'],
			},
		},
	},
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['queryFiles'],
			},
		},
	},
	{
		displayName: 'Properties JSON',
		name: 'propertiesJson',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		placeholder: '{"team":"platform","status":"draft"}',
		description: 'Property filters as a JSON object of string values',
		displayOptions: {
			show: {
				operation: ['queryFiles'],
			},
		},
	},
	{
		displayName: 'Tree Path',
		name: 'treePath',
		type: 'string',
		default: '/',
		displayOptions: {
			show: {
				operation: ['listTree'],
			},
		},
	},
	{
		displayName: 'Depth',
		name: 'depth',
		type: 'number',
		default: 0,
		description: '0 means use the API default',
		displayOptions: {
			show: {
				operation: ['listTree'],
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		description: 'Pagination cursor',
		displayOptions: {
			show: {
				operation: ['queryFiles', 'listTree', 'getEvents'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 100,
		description: '0 means use the API default',
		displayOptions: {
			show: {
				operation: ['queryFiles', 'getEvents'],
			},
		},
	},
	{
		displayName: 'Files JSON',
		name: 'filesJson',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		default: '[\n  {\n    "path": "/notes/example.md",\n    "content": "# Hello",\n    "contentType": "text/markdown"\n  }\n]',
		description: 'Array of bulk write file objects',
		displayOptions: {
			show: {
				operation: ['bulkWrite'],
			},
		},
	},
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		default: 'json',
		options: [
			{ name: 'JSON', value: 'json' },
			{ name: 'Tar', value: 'tar' },
			{ name: 'Patch', value: 'patch' },
		],
		displayOptions: {
			show: {
				operation: ['exportWorkspace'],
			},
		},
	},
];

export class Relayfile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relayfile',
		name: 'relayfile',
		icon: 'file:relayfile.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Read, write, query, and export files from RelayFile workspaces',
		defaults: {
			name: 'Relayfile',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'relayfileApi',
				required: true,
			},
		],
		properties: operationProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const client = await getRelayfileClient(this);
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
			try {
				const operation = getOperationValue(this, itemIndex);
				const workspaceId = getWorkspaceId(this, itemIndex);

				if (operation === 'readFile') {
					const path = this.getNodeParameter('path', itemIndex) as string;
					const response = await client.readFile(workspaceId, path);
					returnData.push(...toItems(this, response as unknown as IDataObject));
					continue;
				}

				if (operation === 'writeFile') {
					const response = await client.writeFile(getWriteFileInput(this, itemIndex));
					returnData.push(...toItems(this, response as unknown as IDataObject));
					continue;
				}

				if (operation === 'queryFiles') {
					const response = await client.queryFiles(workspaceId, getQueryFilesOptions(this, itemIndex));
					const queryItems = response.items.map((entry) => ({
						...entry,
						nextCursor: response.nextCursor,
					})) as IDataObject[];
					returnData.push(
						...feedItems(this, queryItems, {
							items: [],
							nextCursor: response.nextCursor,
						}),
					);
					continue;
				}

				if (operation === 'listTree') {
					const response = await client.listTree(workspaceId, getListTreeOptions(this, itemIndex));
					const treeItems = response.entries.map((entry) => ({
						...entry,
						treePath: response.path,
						nextCursor: response.nextCursor,
					})) as IDataObject[];
					returnData.push(
						...feedItems(this, treeItems, {
							path: response.path,
							entries: [],
							nextCursor: response.nextCursor,
						}),
					);
					continue;
				}

				if (operation === 'bulkWrite') {
					const filesJson = this.getNodeParameter('filesJson', itemIndex) as string;
					const response = await client.bulkWrite({
						workspaceId,
						files: parseBulkWriteFiles(filesJson),
					});
					returnData.push(...toItems(this, response as unknown as IDataObject));
					continue;
				}

				if (operation === 'getEvents') {
					const response = await client.getEvents(workspaceId, getEventsOptions(this, itemIndex));
					const eventItems = response.events.map((event) => ({
						...event,
						nextCursor: response.nextCursor,
					})) as IDataObject[];
					returnData.push(
						...feedItems(this, eventItems, {
							events: [],
							nextCursor: response.nextCursor,
						}),
					);
					continue;
				}

				if (operation === 'exportWorkspace') {
					const format = this.getNodeParameter('format', itemIndex) as 'json' | 'tar' | 'patch';
					const response = await client.exportWorkspace({
						workspaceId,
						format,
					});

					if (format === 'json') {
						const files = ((response as unknown as { files: IDataObject[] }).files).map((file) => ({
							...file,
							format,
						}));
						returnData.push(
							...feedItems(this, files, {
								format,
								files: [],
							}),
						);
						continue;
					}

					const blob = response as Blob;
					const buffer = Buffer.from(await blob.arrayBuffer());
					returnData.push(
						...toItems(this, {
							format,
							mimeType: blob.type || 'application/octet-stream',
							size: buffer.length,
							data: buffer.toString('base64'),
						}),
					);
					continue;
				}

				throw new Error(`Unsupported operation: ${operation}`);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}

				throw asNodeApiError(this, error);
			}
		}

		return [returnData];
	}
}
