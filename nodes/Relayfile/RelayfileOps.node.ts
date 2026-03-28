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
	getOperationsOptions,
	getRelayfileClient,
	getWorkspaceId,
	toItems,
} from './GenericFunctions';

const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		default: 'operation',
		options: [
			{
				name: 'Operation',
				value: 'operation',
			},
		],
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'listOps',
		options: [
			{ name: 'List Operations', value: 'listOps', action: 'List operations' },
			{ name: 'Get Operation', value: 'getOp', action: 'Get an operation' },
			{ name: 'Replay Operation', value: 'replayOp', action: 'Replay an operation' },
		],
	},
	{
		displayName: 'Workspace ID',
		name: 'workspaceId',
		type: 'string',
		default: '',
		required: true,
	},
	{
		displayName: 'Operation ID',
		name: 'opId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['getOp', 'replayOp'],
			},
		},
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: '',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Pending', value: 'pending' },
			{ name: 'Running', value: 'running' },
			{ name: 'Succeeded', value: 'succeeded' },
			{ name: 'Failed', value: 'failed' },
			{ name: 'Dead Lettered', value: 'dead_lettered' },
			{ name: 'Canceled', value: 'canceled' },
		],
		displayOptions: {
			show: {
				operation: ['listOps'],
			},
		},
	},
	{
		displayName: 'Action',
		name: 'action',
		type: 'options',
		default: '',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'File Upsert', value: 'file_upsert' },
			{ name: 'File Delete', value: 'file_delete' },
		],
		displayOptions: {
			show: {
				operation: ['listOps'],
			},
		},
	},
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['listOps'],
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['listOps'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 100,
		displayOptions: {
			show: {
				operation: ['listOps'],
			},
		},
	},
];

export class RelayfileOps implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relayfile Ops',
		name: 'relayfileOps',
		icon: 'file:relayfile.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Monitor and replay RelayFile writeback operations',
		defaults: {
			name: 'Relayfile Ops',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'relayfileApi',
				required: true,
			},
		],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const client = await getRelayfileClient(this);
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const workspaceId = getWorkspaceId(this, itemIndex);

				if (operation === 'listOps') {
					const response = await client.listOps(workspaceId, getOperationsOptions(this, itemIndex));
					const opItems = response.items.map((entry) => ({
						...entry,
						nextCursor: response.nextCursor,
					})) as IDataObject[];
					returnData.push(
						...feedItems(this, opItems, {
							items: [],
							nextCursor: response.nextCursor,
						}),
					);
					continue;
				}

				const opId = this.getNodeParameter('opId', itemIndex) as string;

				if (operation === 'getOp') {
					const response = await client.getOp(workspaceId, opId);
					returnData.push(...toItems(this, response as unknown as IDataObject));
					continue;
				}

				if (operation === 'replayOp') {
					const response = await client.replayOp(workspaceId, opId);
					returnData.push(...toItems(this, response as unknown as IDataObject));
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
