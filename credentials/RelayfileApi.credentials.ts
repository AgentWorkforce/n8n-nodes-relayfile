import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RelayfileApi implements ICredentialType {
	name = 'relayfileApi';

	displayName = 'Relayfile API';

	documentationUrl = 'https://github.com/AgentWorkforce/relayfile';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.relayfile.com',
			required: true,
			placeholder: 'https://api.relayfile.com',
			description: 'RelayFile API base URL',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Bearer token used to access the RelayFile API',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
			method: 'GET',
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
				Accept: 'application/json',
			},
		},
	};
}
