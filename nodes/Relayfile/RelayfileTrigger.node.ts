import type {
	IDataObject,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { asNodeApiError, getRelayfileClient, toItems } from './GenericFunctions';

const eventTypeOptions = [
	{ name: 'File Created', value: 'file.created' },
	{ name: 'File Updated', value: 'file.updated' },
	{ name: 'File Deleted', value: 'file.deleted' },
	{ name: 'Directory Created', value: 'dir.created' },
	{ name: 'Directory Deleted', value: 'dir.deleted' },
	{ name: 'Sync Error', value: 'sync.error' },
	{ name: 'Sync Ignored', value: 'sync.ignored' },
	{ name: 'Sync Suppressed', value: 'sync.suppressed' },
	{ name: 'Sync Stale', value: 'sync.stale' },
	{ name: 'Writeback Failed', value: 'writeback.failed' },
	{ name: 'Writeback Succeeded', value: 'writeback.succeeded' },
];

const properties: INodeProperties[] = [
	{
		displayName: 'Workspace ID',
		name: 'workspaceId',
		type: 'string',
		default: '',
		required: true,
		description: 'RelayFile workspace identifier to watch',
	},
	{
		displayName: 'Event Types',
		name: 'eventTypes',
		type: 'multiOptions',
		default: [],
		options: eventTypeOptions,
		description: 'Leave empty to emit all event types',
	},
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'string',
		default: '',
		description: 'Optional provider filter',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 100,
		description: 'Maximum events to request per poll',
	},
	{
		displayName: 'Poll Interval (Minutes)',
		name: 'pollIntervalMinutes',
		type: 'number',
		default: 1,
		required: true,
		description: 'How often the trigger checks for new RelayFile events',
	},
];

async function fetchNewEvents(
	context: IPollFunctions | ITriggerFunctions,
): Promise<INodeExecutionData[][] | null> {
	const client = await getRelayfileClient(context);
	const staticData = context.getWorkflowStaticData('node');
	const workspaceId = context.getNodeParameter('workspaceId') as string;
	const selectedEventTypes = context.getNodeParameter('eventTypes', []) as string[];
	const provider = (context.getNodeParameter('provider', '') as string).trim() || undefined;
	const limit = context.getNodeParameter('limit', 100) as number;
	const currentCursor = typeof staticData.lastCursor === 'string' ? staticData.lastCursor : undefined;

	const response = await client.getEvents(workspaceId, {
		provider,
		limit: limit > 0 ? limit : undefined,
		cursor: currentCursor,
	});

	if (response.nextCursor) {
		staticData.lastCursor = response.nextCursor;
	}

	const events = response.events
		.filter((event) => selectedEventTypes.length === 0 || selectedEventTypes.includes(event.type))
		.map((event) => ({
			...event,
			nextCursor: response.nextCursor,
		})) as IDataObject[];

	if (events.length === 0) {
		return null;
	}

	return [toItems(context, events)];
}

export class RelayfileTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relayfile Trigger',
		name: 'relayfileTrigger',
		icon: 'file:relayfile.svg',
		group: ['trigger'],
		version: 1,
		description: 'Start a workflow when RelayFile emits new filesystem events',
		eventTriggerDescription: 'Wait for RelayFile file change events',
		activationMessage: 'Watching RelayFile for new events',
		defaults: {
			name: 'Relayfile Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		polling: true,
		credentials: [
			{
				name: 'relayfileApi',
				required: true,
			},
		],
		properties,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		try {
			return await fetchNewEvents(this);
		} catch (error) {
			throw asNodeApiError(this, error);
		}
	}

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const pollIntervalMinutes = Math.max(
			1,
			Math.floor(this.getNodeParameter('pollIntervalMinutes', 1) as number),
		);
		const cronExpression = `0 */${pollIntervalMinutes} * * * *`;

		const runPoll = async () => {
			try {
				const data = await fetchNewEvents(this);
				if (data) {
					this.emit(data);
				}
			} catch (error) {
				this.emitError(asNodeApiError(this, error));
			}
		};

		this.helpers.registerCron(
			{
				expression: cronExpression as any,
			},
			() => {
				void runPoll();
			},
		);

		return {
			closeFunction: async () => undefined,
			manualTriggerFunction: runPoll,
		};
	}
}
