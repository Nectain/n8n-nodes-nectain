import type {IDisplayOptions, INodeProperties} from 'n8n-workflow'

import {documentTypeLocator, fieldsOption, folderLocator, idempotencyKeyOption} from './shared'

function showFor (operation: string[]): IDisplayOptions {
  return {show: {resource: ['document'], operation}}
}

export const documentOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {show: {resource: ['document']}},
    options: [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a document with metadata and an optional primary file',
        action: 'Create a document'
      },
      {
        name: 'Download File',
        value: 'downloadFile',
        description: 'Download the primary file of a document',
        action: 'Download the primary file of a document'
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get a document',
        action: 'Get a document'
      },
      {
        name: 'Replace File',
        value: 'replaceFile',
        description: 'Replace the primary file of a document',
        action: 'Replace the primary file of a document'
      }
    ],
    default: 'create'
  }
]

export const documentFields: INodeProperties[] = [
  {
    ...documentTypeLocator,
    description: 'The type of the document',
    displayOptions: showFor(['create'])
  },
  {
    displayName: 'Input Binary Field',
    name: 'binaryPropertyName',
    type: 'string',
    default: '',
    placeholder: 'e.g. data',
    hint: 'The name of the input binary field with the primary file. ' +
      'Leave empty to create the document without a file.',
    displayOptions: showFor(['create'])
  },
  {
    displayName: 'Attributes Input',
    name: 'attributesInput',
    type: 'options',
    options: [
      {
        name: 'Map Each Attribute',
        value: 'mapper',
        description: 'Set the attributes of the document type one by one'
      },
      {
        name: 'JSON',
        value: 'json',
        description: 'Set the <code>attributes</code> object of the API as JSON'
      }
    ],
    default: 'mapper',
    displayOptions: showFor(['create'])
  },
  {
    displayName: 'Attributes',
    name: 'attributes',
    type: 'resourceMapper',
    noDataExpression: true,
    default: {mappingMode: 'defineBelow', value: null},
    typeOptions: {
      loadOptionsDependsOn: ['documentType.value'],
      resourceMapper: {
        resourceMapperMethod: 'getAttributes',
        mode: 'add',
        fieldWords: {singular: 'attribute', plural: 'attributes'},
        addAllFields: false,
        multiKeyMatch: false,
        supportAutoMap: false
      }
    },
    displayOptions: {
      show: {
        resource: ['document'],
        operation: ['create'],
        attributesInput: ['mapper']
      }
    }
  },
  {
    displayName: 'Attributes (JSON)',
    name: 'attributesJson',
    type: 'json',
    default: '{}',
    description: 'The <code>attributes</code> object of the API, ' +
      'with values keyed by attribute code',
    displayOptions: {
      show: {
        resource: ['document'],
        operation: ['create'],
        attributesInput: ['json']
      }
    }
  },
  {
    displayName: 'Participants',
    name: 'participants',
    type: 'fixedCollection',
    typeOptions: {multipleValues: true},
    placeholder: 'Add Participant',
    default: {},
    displayOptions: showFor(['create']),
    options: [
      {
        displayName: 'Participant',
        name: 'participant',
        values: [
          {
            displayName: 'Role Name or ID',
            name: 'role',
            type: 'options',
            typeOptions: {
              loadOptionsMethod: 'getRoles',
              loadOptionsDependsOn: ['documentType.value']
            },
            default: '',
            description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>'
          },
          {
            displayName: 'Kind',
            name: 'kind',
            type: 'options',
            options: [
              {name: 'Organization Unit', value: 'organizationObject'},
              {name: 'Person', value: 'principal'}
            ],
            default: 'principal'
          },
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
            placeholder: 'e.g. jdoe',
            description: 'The login name of the person',
            displayOptions: {show: {kind: ['principal']}}
          },
          {
            displayName: 'Code',
            name: 'code',
            type: 'string',
            default: '',
            placeholder: 'e.g. finance-dept',
            description: 'The code of the organization unit',
            displayOptions: {show: {kind: ['organizationObject']}}
          }
        ]
      }
    ]
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: showFor(['create']),
    options: [
      {
        ...folderLocator,
        description: 'The repository folder of the document. ' +
          'Without it, the server puts the document in its default folder.'
      },
      idempotencyKeyOption('creating another document'),
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: ''
      }
    ]
  },
  {
    displayName: 'Document ID',
    name: 'documentId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. 10042',
    displayOptions: showFor(['get', 'downloadFile', 'replaceFile'])
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: showFor(['get']),
    options: [fieldsOption]
  },
  {
    displayName: 'Put Output File in Field',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    hint: 'The name of the output binary field to put the file in',
    displayOptions: showFor(['downloadFile'])
  },
  {
    displayName: 'Input Binary Field',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    hint: 'The name of the input binary field with the new primary file',
    displayOptions: showFor(['replaceFile'])
  }
]
