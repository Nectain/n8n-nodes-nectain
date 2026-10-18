import type {
  IAuthenticateGeneric,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties
} from 'n8n-workflow'

export class NectainApi implements ICredentialType {
  name = 'nectainApi'

  displayName = 'Nectain API'

  icon: Icon = {
    light: 'file:../nodes/Nectain/nectain.svg',
    dark: 'file:../nodes/Nectain/nectain.dark.svg'
  }

  documentationUrl = 'https://github.com/Nectain/n8n-nodes-nectain#credentials'

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://nectain.example.com',
      description: 'The address of the Nectain installation'
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {password: true},
      default: '',
      required: true,
      description: 'An API key with the <code>rest</code> scope, ' +
        'created in <b>My API Keys</b> of the Nectain user menu'
    }
  ]

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}'
      }
    }
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v1/document-types'
    }
  }
}
