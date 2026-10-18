import type {INodeProperties, INodePropertyModeValidation} from 'n8n-workflow'

const idValidation: INodePropertyModeValidation[] = [
  {type: 'regex', properties: {regex: '^[0-9]+$', errorMessage: 'An ID is a whole number'}}
]

export const documentTypeLocator: INodeProperties = {
  displayName: 'Document Type',
  name: 'documentType',
  type: 'resourceLocator',
  default: {mode: 'list', value: ''},
  required: true,
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: {searchListMethod: 'searchDocumentTypes', searchable: true}
    },
    {
      displayName: 'By Code',
      name: 'code',
      type: 'string',
      placeholder: 'e.g. invoice'
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'e.g. 7',
      validation: idValidation
    }
  ]
}

export const templateLocator: INodeProperties = {
  displayName: 'Template',
  name: 'template',
  type: 'resourceLocator',
  default: {mode: 'list', value: ''},
  description: 'The recognition template',
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: {searchListMethod: 'searchRecognitionTemplates', searchable: true}
    },
    {
      displayName: 'By Code',
      name: 'code',
      type: 'string',
      placeholder: 'e.g. invoices'
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'e.g. 3000000101',
      validation: idValidation
    }
  ]
}

export const folderLocator: INodeProperties = {
  displayName: 'Folder',
  name: 'folder',
  type: 'resourceLocator',
  default: {mode: 'path', value: ''},
  description: 'A repository folder: <code>/Repository</code> or a folder inside it',
  modes: [
    {
      displayName: 'By Path',
      name: 'path',
      type: 'string',
      placeholder: 'e.g. /Repository/Finance/Invoices'
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'e.g. 55',
      validation: idValidation
    }
  ]
}

export const fieldsOption: INodeProperties = {
  displayName: 'Fields',
  name: 'select',
  type: 'string',
  default: '',
  placeholder: 'e.g. title,documentType,attributes(amount)',
  description: 'Comma-separated properties to return, ' +
    'sent as the <code>select</code> query parameter. ' +
    'Without it, the server returns the default properties.'
}

export function idempotencyKeyOption (result: string): INodeProperties {
  return {
    displayName: 'Idempotency Key',
    name: 'idempotencyKey',
    type: 'string',
    default: '',
    placeholder: 'e.g. 9b2f0c7e-3d4a-4f1b-8c6e-2a5d7e9f1b3c',
    description: 'A key of 1 to 64 Latin letters, digits, ' +
      '<code>_</code>, <code>+</code>, <code>=</code>, or <code>-</code>. ' +
      'A repeated execution with the same key and parameters ' +
      `returns the first result instead of ${result}.`
  }
}
