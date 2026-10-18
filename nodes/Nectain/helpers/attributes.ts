import type {
  FieldType,
  IDataObject,
  INode,
  INodeParameterResourceLocator,
  ResourceMapperField
} from 'n8n-workflow'
import {NodeOperationError} from 'n8n-workflow'

import {documentTypeRequest} from './locator'
import type {NectainContext} from './request'
import {nectainRequest} from './request'

export interface AttributeDefinition {
  code: string
  name: string
  dataType: string
}

/**
 * Data types of the attributes of a document type, by attribute code,
 * per document type locator.
 */
export type AttributeTypeCache = Map<string, Map<string, string>>

/**
 * The attribute data types a document can be created with through a mapped field.
 * `collection`, `file`, and `fileCollection` values are not set in a document creation request.
 */
const FIELD_TYPES = new Map<string, FieldType>([
  ['text', 'string'],
  ['richText', 'string'],
  ['number', 'number'],
  ['dateTime', 'dateTime'],
  ['boolean', 'boolean'],
  ['hyperlink', 'string'],
  ['reference', 'string'],
  ['multipleReferences', 'string']
])

export async function loadAttributes (
  ctx: NectainContext,
  documentType: INodeParameterResourceLocator
): Promise<AttributeDefinition[]> {
  const {url, qs} = documentTypeRequest(documentType)
  const response = await nectainRequest(ctx, {
    method: 'GET',
    url,
    qs: {...qs, select: 'attributes'}
  })

  return (response.body as {attributes: AttributeDefinition[]}).attributes
}

export function toAttributeFields (attributes: AttributeDefinition[]): ResourceMapperField[] {
  const fields: ResourceMapperField[] = []
  for (const attribute of attributes) {
    const type = FIELD_TYPES.get(attribute.dataType)
    if (type === undefined) {
      continue
    }

    fields.push({
      id: attribute.code,
      displayName: attribute.name,
      type,
      required: false,
      defaultMatch: false,
      canBeUsedToMatch: false,
      display: true
    })
  }

  return fields
}

export async function attributeTypes (
  ctx: NectainContext,
  documentType: INodeParameterResourceLocator,
  cache: AttributeTypeCache
): Promise<Map<string, string>> {
  const key = `${documentType.mode}:${String(documentType.value)}`
  let types = cache.get(key)
  if (types === undefined) {
    const attributes = await loadAttributes(ctx, documentType)
    types = new Map(attributes.map(attribute => [attribute.code, attribute.dataType]))
    cache.set(key, types)
  }

  return types
}

/**
 * Converts the values of mapped fields to the `attributes` object of a document creation request.
 * An empty value is left out.
 * A reference is sent by ID when the value is a number and by code otherwise;
 * multiple references are a comma-separated list of such values;
 * a hyperlink gets its URL as the caption.
 */
export function toAttributeValues (values: IDataObject, types: Map<string, string>): IDataObject {
  const attributes: IDataObject = {}
  for (const [code, value] of Object.entries(values)) {
    if (value === '' || value === null || value === undefined) {
      continue
    }

    switch (types.get(code)) {
      case 'reference':
        attributes[code] = attributeReference(String(value))
        break
      case 'multipleReferences':
        attributes[code] = String(value)
          .split(',')
          .map(item => item.trim())
          .filter(item => item !== '')
          .map(attributeReference)
        break
      case 'hyperlink':
        attributes[code] = {url: value, caption: value}
        break
      default:
        attributes[code] = value
    }
  }

  return attributes
}

/** Reads the attributes JSON parameter, which is an object when an expression sets it. */
export function parseAttributesJson (node: INode, value: unknown, itemIndex: number): IDataObject {
  if (typeof value !== 'string') {
    return value as IDataObject
  }

  try {
    return JSON.parse(value) as IDataObject
  } catch (error) {
    throw new NodeOperationError(node, 'The attributes are not valid JSON', {
      description: (error as Error).message,
      itemIndex
    })
  }
}

function attributeReference (value: string): IDataObject {
  return /^\d+$/.test(value)
    ? {id: Number(value)}
    : {code: value}
}
