import type {IDisplayOptions, INodeProperties} from 'n8n-workflow'

import {fieldsOption, idempotencyKeyOption, templateLocator} from './shared'

function showFor (operation: string[]): IDisplayOptions {
  return {show: {resource: ['recognitionJob'], operation}}
}

export const recognitionJobOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {show: {resource: ['recognitionJob']}},
    options: [
      {
        name: 'Download File',
        value: 'downloadFile',
        description: 'Download the file of a recognition job',
        action: 'Download the file of a recognition job'
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get a recognition job',
        action: 'Get a recognition job'
      },
      {
        name: 'Get Descendants',
        value: 'getDescendants',
        description: 'Get the child jobs of a recognition job and their children',
        action: 'Get the descendants of a recognition job'
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many recognition jobs',
        action: 'Get many recognition jobs'
      },
      {
        name: 'Get Result',
        value: 'getResult',
        description: 'Get the created document or the extracted data of a recognition job',
        action: 'Get the result of a recognition job'
      },
      {
        name: 'Start',
        value: 'start',
        description: 'Start the recognition of a file',
        action: 'Start a recognition'
      }
    ],
    default: 'start'
  }
]

const filters: INodeProperties = {
  displayName: 'Filters',
  name: 'filters',
  type: 'collection',
  placeholder: 'Add Filter',
  default: {},
  options: [
    {
      displayName: 'Is Group',
      name: 'isGroup',
      type: 'boolean',
      default: true,
      description: 'Whether to return only the group jobs of batches. ' +
        'When off, only the other jobs are returned.'
    },
    {
      displayName: 'Is Multi-Document',
      name: 'isMultiDoc',
      type: 'boolean',
      default: true,
      description: 'Whether to return only the jobs ' +
        'that split their file into several documents. ' +
        'When off, only the other jobs are returned.'
    },
    {
      displayName: 'Status',
      name: 'status',
      type: 'multiOptions',
      options: [
        {name: 'Canceled', value: 'canceled'},
        {name: 'Completed With Errors', value: 'completedWithErrors'},
        {name: 'Error', value: 'error'},
        {name: 'Hanging', value: 'hanging'},
        {name: 'New', value: 'new'},
        {name: 'Pending', value: 'pending'},
        {name: 'Success', value: 'success'}
      ],
      default: [],
      description: 'Return only the jobs with one of these statuses'
    },
    {
      ...templateLocator,
      description: 'Return only the jobs of this recognition template'
    }
  ]
}

export const recognitionJobFields: INodeProperties[] = [
  {
    ...templateLocator,
    required: true,
    displayOptions: showFor(['start'])
  },
  {
    displayName: 'Input Binary Field',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    hint: 'The name of the input binary field with the file to recognize',
    displayOptions: showFor(['start'])
  },
  {
    displayName: 'Auto Create Document',
    name: 'autoCreateDocument',
    type: 'boolean',
    default: true,
    description: 'Whether to create the document after a successful recognition. ' +
      'When off, the result holds the extracted data.',
    displayOptions: showFor(['start'])
  },
  {
    displayName: 'Wait for Completion',
    name: 'waitForCompletion',
    type: 'boolean',
    default: false,
    description: 'Whether to wait until the job finishes and output the final job with its result',
    displayOptions: showFor(['start'])
  },
  {
    displayName: 'Timeout',
    name: 'timeout',
    type: 'number',
    typeOptions: {minValue: 1},
    default: 10,
    description: 'Minutes to wait for the job. ' +
      'When they pass, the item fails with the ID of the job.',
    displayOptions: {
      show: {
        resource: ['recognitionJob'],
        operation: ['start'],
        waitForCompletion: [true]
      }
    }
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: showFor(['start']),
    options: [
      idempotencyKeyOption('starting another recognition'),
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'The name of the job. Without it, the job is named after its file.'
      }
    ]
  },
  {
    displayName: 'Job ID',
    name: 'jobId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. 3000000501',
    displayOptions: showFor(['downloadFile', 'get', 'getDescendants', 'getResult'])
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: showFor(['getAll'])
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    typeOptions: {minValue: 1},
    default: 50,
    description: 'Max number of results to return',
    displayOptions: {
      show: {
        resource: ['recognitionJob'],
        operation: ['getAll'],
        returnAll: [false]
      }
    }
  },
  {
    ...filters,
    displayOptions: showFor(['getAll', 'getDescendants'])
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: showFor(['get', 'getAll', 'getDescendants']),
    options: [
      {
        ...fieldsOption,
        placeholder: 'e.g. status,startedAt,finishedAt'
      }
    ]
  },
  {
    displayName: 'Put Output File in Field',
    name: 'binaryPropertyName',
    type: 'string',
    required: true,
    default: 'data',
    hint: 'The name of the output binary field to put the file in',
    displayOptions: showFor(['downloadFile'])
  }
]
