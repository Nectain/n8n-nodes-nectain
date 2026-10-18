import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeParameterResourceLocator,
  ResourceMapperValue
} from 'n8n-workflow'

import type {AttributeTypeCache} from '../helpers/attributes'
import {attributeTypes, parseAttributesJson, toAttributeValues} from '../helpers/attributes'
import {toBinaryItem} from '../helpers/binary'
import {isLocatorSet, toReference} from '../helpers/locator'
import type {DocumentJson} from '../helpers/multipart'
import {documentJson, FILE_PART, jsonWithFile} from '../helpers/multipart'
import {nectainRequest, selectQuery} from '../helpers/request'

interface Participant {
  role: string
  kind: 'principal' | 'organizationObject'
  name?: string
  code?: string
}

interface CreateFields {
  title?: string
  folder?: INodeParameterResourceLocator
  idempotencyKey?: string
}

async function create (
  this: IExecuteFunctions,
  itemIndex: number,
  attributeCache: AttributeTypeCache
): Promise<INodeExecutionData[]> {
  const documentType = this.getNodeParameter(
    'documentType',
    itemIndex
  ) as INodeParameterResourceLocator
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string
  const additionalFields = this.getNodeParameter('additionalFields', itemIndex) as CreateFields
  const participants = this.getNodeParameter(
    'participants',
    itemIndex
  ) as {participant?: Participant[]}
  const document: DocumentJson = {
    documentType: toReference(documentType),
    title: additionalFields.title,
    folder: isLocatorSet(additionalFields.folder)
      ? toReference(additionalFields.folder)
      : undefined,
    attributes: await readAttributes(this, itemIndex, documentType, attributeCache),
    participants: toParticipants(participants.participant ?? [])
  }

  const headers: IDataObject = {}
  if (additionalFields.idempotencyKey) {
    headers['Idempotency-Key'] = additionalFields.idempotencyKey
  }

  let body: Buffer | string
  if (binaryPropertyName === '') {
    headers['Content-Type'] = 'application/json'
    body = documentJson(document)
  } else {
    const multipart = await jsonWithFile(
      this,
      itemIndex,
      binaryPropertyName,
      'document',
      documentJson({
        ...document,
        primaryFile: {contentPart: FILE_PART}
      })
    )
    headers['Content-Type'] = multipart.contentType
    body = multipart.body
  }

  const response = await nectainRequest(this, {
    method: 'POST',
    url: '/api/v1/documents',
    headers,
    body
  })

  return [{
    json: response.body as IDataObject
  }]
}

async function get (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const id = this.getNodeParameter('documentId', itemIndex) as string
  const options = this.getNodeParameter('options', itemIndex) as {select?: string}
  const response = await nectainRequest(this, {
    method: 'GET',
    url: `/api/v1/documents/${encodeURIComponent(id)}`,
    qs: selectQuery(options)
  })

  return [{
    json: response.body as IDataObject
  }]
}

async function downloadFile (
  this: IExecuteFunctions,
  itemIndex: number
): Promise<INodeExecutionData[]> {
  const id = this.getNodeParameter('documentId', itemIndex) as string
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string
  const response = await nectainRequest(this, {
    method: 'GET',
    url: `/api/v1/documents/${encodeURIComponent(id)}/primary-file/content`,
    binary: true
  })

  return [
    await toBinaryItem(this, response, binaryPropertyName, id)
  ]
}

async function replaceFile (
  this: IExecuteFunctions,
  itemIndex: number
): Promise<INodeExecutionData[]> {
  const id = this.getNodeParameter('documentId', itemIndex) as string
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string
  const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName)
  await nectainRequest(this, {
    method: 'PUT',
    url: `/api/v1/documents/${encodeURIComponent(id)}/primary-file/content`,
    // Without a file name, the server derives a generic one from the media type
    qs: binaryData.fileName === undefined
      ? {}
      : {filename: binaryData.fileName},
    headers: {'Content-Type': binaryData.mimeType},
    body: await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName)
  })

  return [{
    json: {
      id: Number(id),
      success: true
    }
  }]
}

async function readAttributes (
  ctx: IExecuteFunctions,
  itemIndex: number,
  documentType: INodeParameterResourceLocator,
  cache: AttributeTypeCache
): Promise<IDataObject | undefined> {
  let attributes: IDataObject
  if (ctx.getNodeParameter('attributesInput', itemIndex) === 'json') {
    attributes = parseAttributesJson(
      ctx.getNode(),
      ctx.getNodeParameter('attributesJson', itemIndex),
      itemIndex
    )
  } else {
    const mapper = ctx.getNodeParameter('attributes', itemIndex) as ResourceMapperValue
    const values = mapper.value ?? {}
    // The mapped fields keep no data type, and a reference or a hyperlink is sent as an object
    const types = Object.keys(values).length === 0
      ? new Map<string, string>()
      : await attributeTypes(ctx, documentType, cache)
    attributes = toAttributeValues(values, types)
  }

  return Object.keys(attributes).length === 0
    ? undefined
    : attributes
}

function toParticipants (entries: Participant[]): IDataObject | undefined {
  if (entries.length === 0) {
    return undefined
  }

  const participants: Record<string, IDataObject[]> = {}
  for (const {role, kind, name, code} of entries) {
    const participant = kind === 'principal'
      ? {kind, name}
      : {kind, code}
    participants[role] = [...(participants[role] ?? []), participant]
  }

  return participants
}

export const documentHandlers = {
  create,
  get,
  downloadFile,
  replaceFile
}
