import type {INodeProperties} from 'n8n-workflow'

export const recognitionTemplateOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {show: {resource: ['recognitionTemplate']}},
    options: [
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many recognition templates',
        action: 'Get many recognition templates'
      }
    ],
    default: 'getAll'
  }
]
