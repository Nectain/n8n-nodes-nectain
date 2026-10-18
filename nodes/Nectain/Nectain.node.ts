import type {
  IExecuteFunctions,
  INode,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription
} from 'n8n-workflow'
import {NodeApiError, NodeConnectionTypes, NodeOperationError} from 'n8n-workflow'

import {documentFields, documentOperations} from './descriptions/document'
import {documentTypeFields, documentTypeOperations} from './descriptions/documentType'
import {recognitionJobFields, recognitionJobOperations} from './descriptions/recognitionJob'
import {recognitionTemplateOperations} from './descriptions/recognitionTemplate'
import type {AttributeTypeCache} from './helpers/attributes'
import {listSearch, loadOptions, resourceMapping} from './methods'
import {documentHandlers} from './operations/document'
import {documentTypeHandlers} from './operations/documentType'
import {recognitionJobHandlers} from './operations/recognitionJob'
import {recognitionTemplateHandlers} from './operations/recognitionTemplate'

type OperationHandler = (
  this: IExecuteFunctions,
  itemIndex: number,
  attributeCache: AttributeTypeCache
) => Promise<INodeExecutionData[]>

const HANDLERS: Partial<Record<string, Partial<Record<string, OperationHandler>>>> = {
  document: documentHandlers,
  documentType: documentTypeHandlers,
  recognitionJob: recognitionJobHandlers,
  recognitionTemplate: recognitionTemplateHandlers
}

/** Adds the item index to an error, so n8n shows which input item failed. */
function itemError (
  node: INode,
  error: Error,
  itemIndex: number
): NodeApiError | NodeOperationError {
  if (error instanceof NodeApiError || error instanceof NodeOperationError) {
    error.context.itemIndex = itemIndex
    return error
  }

  return new NodeOperationError(node, error, {itemIndex})
}

export class Nectain implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Nectain',
    name: 'nectain',
    icon: {light: 'file:nectain.svg', dark: 'file:nectain.dark.svg'},
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Create documents and recognize files in Nectain',
    defaults: {name: 'Nectain'},
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{name: 'nectainApi', required: true}],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {name: 'Document', value: 'document'},
          {name: 'Document Type', value: 'documentType'},
          {name: 'Recognition Job', value: 'recognitionJob'},
          {name: 'Recognition Template', value: 'recognitionTemplate'}
        ],
        default: 'document'
      },
      ...documentOperations,
      ...documentFields,
      ...documentTypeOperations,
      ...documentTypeFields,
      ...recognitionJobOperations,
      ...recognitionJobFields,
      ...recognitionTemplateOperations
    ]
  }

  methods = {
    listSearch,
    loadOptions,
    resourceMapping
  }

  async execute (this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = []
    const attributeCache: AttributeTypeCache = new Map()
    for (const itemIndex of this.getInputData().keys()) {
      try {
        const resource = this.getNodeParameter('resource', itemIndex) as string
        const operation = this.getNodeParameter('operation', itemIndex) as string
        const run = HANDLERS[resource]?.[operation]
        if (run === undefined) {
          throw new NodeOperationError(
            this.getNode(),
            `The operation "${operation}" of the resource "${resource}" is not supported`,
            {itemIndex}
          )
        }

        for (const result of await run.call(this, itemIndex, attributeCache)) {
          returnData.push({
            ...result,
            pairedItem: {item: itemIndex}
          })
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {error: (error as Error).message},
            pairedItem: {item: itemIndex}
          })
          continue
        }

        throw itemError(this.getNode(), error as Error, itemIndex)
      }
    }

    return [returnData]
  }
}
