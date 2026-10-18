import type {IDisplayOptions, INodeProperties} from 'n8n-workflow'

import {documentTypeLocator, fieldsOption, folderLocator} from './shared'

function showFor (operation: string[]): IDisplayOptions {
  return {show: {resource: ['documentType'], operation}}
}

export const documentTypeOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {show: {resource: ['documentType']}},
    options: [
      {
        name: 'Get',
        value: 'get',
        description: 'Get a document type with its attributes, roles, and states',
        action: 'Get a document type'
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many document types',
        action: 'Get many document types'
      }
    ],
    default: 'get'
  }
]

export const documentTypeFields: INodeProperties[] = [
  {
    ...documentTypeLocator,
    description: 'The document type to get',
    displayOptions: showFor(['get'])
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: showFor(['get']),
    options: [
      {
        ...fieldsOption,
        placeholder: 'e.g. code,name,attributes'
      }
    ]
  },
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: showFor(['getAll']),
    options: [
      {
        ...folderLocator,
        description: 'Return only the document types allowed in this repository folder'
      },
      {
        displayName: 'Only Creatable',
        name: 'onlyCreatable',
        type: 'boolean',
        default: true,
        description: 'Whether to return only the document types ' +
          'that the owner of the API key can create'
      }
    ]
  }
]
