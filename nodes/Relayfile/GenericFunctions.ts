import type {
	BulkWriteFile,
	FileSemantics,
	GetEventsOptions,
	GetOperationsOptions,
	ListTreeOptions,
	QueryFilesOptions,
	WriteFileInput,
} from '@relayfile/sdk';
import {
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type IPollFunctions,
	type ITriggerFunctions,
	type JsonObject,
	NodeApiError,
} from 'n8n-workflow';

type RelayFileSdk = typeof import('@relayfile/sdk');

export interface RelayfileCredentials {
	baseUrl: string;
	accessToken: string;
}

const importRelayfileSdk = new Function(
	'specifier',
	'return import(specifier);',
) as <T>(specifier: string) => Promise<T>;

export async function loadRelayfileSdk(): Promise<RelayFileSdk> {
	return importRelayfileSdk<RelayFileSdk>('@relayfile/sdk');
}

export async function getRelayfileClient(context: {
	getCredentials<T extends object = RelayfileCredentials>(type: string): Promise<T>;
}) {
	const credentials = await context.getCredentials<RelayfileCredentials>('relayfileApi');
	const { RelayFileClient } = await loadRelayfileSdk();

	return new RelayFileClient({
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		token: credentials.accessToken,
		userAgent: 'n8n-nodes-relayfile/0.1.0',
	});
}

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/, '');
}

export function parseOptionalJson<T>(value: string | undefined, label: string): T | undefined {
	if (!value || value.trim() === '') {
		return undefined;
	}

	try {
		return JSON.parse(value) as T;
	} catch (error) {
		throw new Error(`${label} must be valid JSON: ${(error as Error).message}`);
	}
}

export function parseSemantics(value: string | undefined): FileSemantics | undefined {
	return parseOptionalJson<FileSemantics>(value, 'Semantics JSON');
}

export function parseProperties(value: string | undefined): Record<string, string> | undefined {
	const parsed = parseOptionalJson<Record<string, unknown>>(value, 'Properties JSON');
	if (!parsed) {
		return undefined;
	}

	const normalized: Record<string, string> = {};
	for (const [key, propertyValue] of Object.entries(parsed)) {
		if (typeof propertyValue !== 'string') {
			throw new Error('Properties JSON must be an object of string values.');
		}
		normalized[key] = propertyValue;
	}

	return normalized;
}

export function parseBulkWriteFiles(value: string): BulkWriteFile[] {
	const parsed = parseOptionalJson<unknown>(value, 'Files JSON');

	if (!Array.isArray(parsed)) {
		throw new Error('Files JSON must be an array.');
	}

	return parsed.map((entry, index) => {
		if (!entry || typeof entry !== 'object') {
			throw new Error(`Files JSON item ${index + 1} must be an object.`);
		}

		const item = entry as Record<string, unknown>;
		if (typeof item.path !== 'string' || typeof item.content !== 'string') {
			throw new Error(`Files JSON item ${index + 1} must contain string path and content.`);
		}

		if (item.contentType !== undefined && typeof item.contentType !== 'string') {
			throw new Error(`Files JSON item ${index + 1} contentType must be a string.`);
		}

		if (
			item.encoding !== undefined &&
			item.encoding !== 'utf-8' &&
			item.encoding !== 'base64'
		) {
			throw new Error(`Files JSON item ${index + 1} encoding must be utf-8 or base64.`);
		}

		return {
			path: item.path,
			content: item.content,
			contentType: item.contentType as string | undefined,
			encoding: item.encoding as 'utf-8' | 'base64' | undefined,
		};
	});
}

export function toItems(
	context: Pick<IExecuteFunctions | IPollFunctions | ITriggerFunctions, 'helpers'>,
	data: IDataObject | IDataObject[],
): INodeExecutionData[] {
	return context.helpers.returnJsonArray(data);
}

export function feedItems(
	context: Pick<IExecuteFunctions | IPollFunctions | ITriggerFunctions, 'helpers'>,
	entries: IDataObject[],
	fallback: IDataObject,
): INodeExecutionData[] {
	return context.helpers.returnJsonArray(entries.length > 0 ? entries : [fallback]);
}

export function asNodeApiError(
	context: Pick<IExecuteFunctions | IPollFunctions | ITriggerFunctions, 'getNode'>,
	error: unknown,
): NodeApiError {
	if (error instanceof NodeApiError) {
		return error;
	}

	const base =
		error && typeof error === 'object'
			? (error as IDataObject)
			: ({ message: String(error) } as IDataObject);

	if (!base.message && error instanceof Error) {
		base.message = error.message;
	}

	return new NodeApiError(context.getNode(), base as unknown as JsonObject);
}

export function getOperationValue(
	context: IExecuteFunctions,
	itemIndex: number,
): string {
	return context.getNodeParameter('operation', itemIndex) as string;
}

export function getWorkspaceId(
	context: IExecuteFunctions | IPollFunctions,
	itemIndex = 0,
): string {
	return context.getNodeParameter('workspaceId', itemIndex) as string;
}

export function getListTreeOptions(
	context: IExecuteFunctions,
	itemIndex: number,
): ListTreeOptions {
	return {
		path: emptyToUndefined(context.getNodeParameter('treePath', itemIndex, '') as string) ?? '/',
		depth: optionalNumber(context.getNodeParameter('depth', itemIndex, 0) as number),
		cursor: emptyToUndefined(context.getNodeParameter('cursor', itemIndex, '') as string),
	};
}

export function getQueryFilesOptions(
	context: IExecuteFunctions,
	itemIndex: number,
): QueryFilesOptions {
	return {
		path: emptyToUndefined(context.getNodeParameter('queryPath', itemIndex, '') as string),
		provider: emptyToUndefined(context.getNodeParameter('provider', itemIndex, '') as string),
		relation: emptyToUndefined(context.getNodeParameter('relation', itemIndex, '') as string),
		permission: emptyToUndefined(context.getNodeParameter('permission', itemIndex, '') as string),
		comment: emptyToUndefined(context.getNodeParameter('comment', itemIndex, '') as string),
		properties: parseProperties(
			context.getNodeParameter('propertiesJson', itemIndex, '') as string,
		),
		cursor: emptyToUndefined(context.getNodeParameter('cursor', itemIndex, '') as string),
		limit: optionalNumber(context.getNodeParameter('limit', itemIndex, 100) as number),
	};
}

export function getEventsOptions(
	context: IExecuteFunctions | IPollFunctions,
	itemIndex = 0,
): GetEventsOptions {
	return {
		provider: emptyToUndefined(context.getNodeParameter('provider', itemIndex, '') as string),
		cursor: emptyToUndefined(context.getNodeParameter('cursor', itemIndex, '') as string),
		limit: optionalNumber(context.getNodeParameter('limit', itemIndex, 100) as number),
	};
}

export function getOperationsOptions(
	context: IExecuteFunctions,
	itemIndex: number,
): GetOperationsOptions {
	return {
		status: optionalString(context.getNodeParameter('status', itemIndex, '') as string) as
			| GetOperationsOptions['status']
			| undefined,
		action: optionalString(context.getNodeParameter('action', itemIndex, '') as string) as
			| GetOperationsOptions['action']
			| undefined,
		provider: emptyToUndefined(context.getNodeParameter('provider', itemIndex, '') as string),
		cursor: emptyToUndefined(context.getNodeParameter('cursor', itemIndex, '') as string),
		limit: optionalNumber(context.getNodeParameter('limit', itemIndex, 100) as number),
	};
}

export function getWriteFileInput(
	context: IExecuteFunctions,
	itemIndex: number,
): WriteFileInput {
	return {
		workspaceId: getWorkspaceId(context, itemIndex),
		path: context.getNodeParameter('path', itemIndex) as string,
		baseRevision: context.getNodeParameter('baseRevision', itemIndex) as string,
		content: context.getNodeParameter('content', itemIndex) as string,
		contentType: emptyToUndefined(context.getNodeParameter('contentType', itemIndex, '') as string),
		encoding: optionalString(
			context.getNodeParameter('encoding', itemIndex, '') as string,
		) as WriteFileInput['encoding'],
		semantics: parseSemantics(
			context.getNodeParameter('semanticsJson', itemIndex, '') as string,
		),
	};
}

export function emptyToUndefined(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	return normalized === '' ? undefined : normalized;
}

export function optionalString(value: string | undefined): string | undefined {
	return emptyToUndefined(value);
}

export function optionalNumber(value: number | undefined): number | undefined {
	if (value === undefined || Number.isNaN(value) || value <= 0) {
		return undefined;
	}

	return value;
}
