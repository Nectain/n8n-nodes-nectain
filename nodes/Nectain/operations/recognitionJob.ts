import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeParameterResourceLocator
} from 'n8n-workflow'

import {toBinaryItem} from '../helpers/binary'
import {isLocatorSet, toReference} from '../helpers/locator'
import {FILE_PART, jobJson, jsonWithFile} from '../helpers/multipart'
import {fetchAll} from '../helpers/pagination'
import {nectainRequest, selectQuery} from '../helpers/request'
import {waitForJob} from '../helpers/wait'

interface JobFilters {
  status?: string[]
  isGroup?: boolean
  isMultiDoc?: boolean
  template?: INodeParameterResourceLocator
}

interface StartOptions {
  name?: string
  idempotencyKey?: string
}

async function start (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const template = this.getNodeParameter('template', itemIndex) as INodeParameterResourceLocator
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string
  const options = this.getNodeParameter('options', itemIndex) as StartOptions
  const json = jobJson({
    template: toReference(template),
    files: [{contentPart: FILE_PART}],
    autoCreateDocument: this.getNodeParameter('autoCreateDocument', itemIndex) as boolean,
    name: options.name
  })
  const multipart = await jsonWithFile(this, itemIndex, binaryPropertyName, 'job', json)

  const headers: IDataObject = {'Content-Type': multipart.contentType}
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const response = await nectainRequest(this, {
    method: 'POST',
    url: '/api/v1/recognition-jobs',
    headers,
    body: multipart.body
  })

  let job = response.body as IDataObject
  if (this.getNodeParameter('waitForCompletion', itemIndex) as boolean) {
    const timeoutMinutes = this.getNodeParameter('timeout', itemIndex) as number
    job = await waitForJob(this, job, timeoutMinutes * 60 * 1000)
  }

  return [{
    json: job
  }]
}

async function get (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const options = this.getNodeParameter('options', itemIndex) as {select?: string}
  const response = await nectainRequest(this, {
    method: 'GET',
    url: jobUrl(this, itemIndex),
    qs: selectQuery(options)
  })

  return [{
    json: response.body as IDataObject
  }]
}

async function getAll (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean
  const limit = returnAll
    ? 0
    : this.getNodeParameter('limit', itemIndex) as number
  const filters = this.getNodeParameter('filters', itemIndex) as JobFilters
  const options = this.getNodeParameter('options', itemIndex) as {select?: string}
  const jobs = await fetchAll(
    this,
    '/api/v1/recognition-jobs',
    {...filterQuery(filters), ...selectQuery(options)},
    {returnAll, limit}
  )

  return jobs.map(json => ({json}))
}

async function getDescendants (
  this: IExecuteFunctions,
  itemIndex: number
): Promise<INodeExecutionData[]> {
  const filters = this.getNodeParameter('filters', itemIndex) as JobFilters
  const options = this.getNodeParameter('options', itemIndex) as {select?: string}
  const response = await nectainRequest(this, {
    method: 'GET',
    url: `${jobUrl(this, itemIndex)}/descendants`,
    qs: {...filterQuery(filters), ...selectQuery(options)}
  })

  return (response.body as IDataObject[]).map(json => ({json}))
}

async function getResult (
  this: IExecuteFunctions,
  itemIndex: number
): Promise<INodeExecutionData[]> {
  const response = await nectainRequest(this, {
    method: 'GET',
    url: `${jobUrl(this, itemIndex)}/result`
  })

  return [{
    json: response.body as IDataObject
  }]
}

async function downloadFile (
  this: IExecuteFunctions,
  itemIndex: number
): Promise<INodeExecutionData[]> {
  const id = this.getNodeParameter('jobId', itemIndex) as string
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string
  const response = await nectainRequest(this, {
    method: 'GET',
    url: `/api/v1/recognition-jobs/${encodeURIComponent(id)}/file/content`,
    binary: true
  })

  return [
    await toBinaryItem(this, response, binaryPropertyName, id)
  ]
}

function jobUrl (ctx: IExecuteFunctions, itemIndex: number): string {
  const id = ctx.getNodeParameter('jobId', itemIndex) as string

  return `/api/v1/recognition-jobs/${encodeURIComponent(id)}`
}

function filterQuery (filters: JobFilters): IDataObject {
  const qs: IDataObject = {}

  if (filters.status !== undefined && filters.status.length > 0) {
    qs.status = filters.status.join(',')
  }

  if (filters.isGroup !== undefined) {
    qs.isGroup = filters.isGroup
  }

  if (filters.isMultiDoc !== undefined) {
    qs.isMultiDoc = filters.isMultiDoc
  }

  if (isLocatorSet(filters.template)) {
    if (filters.template.mode === 'id') {
      qs.templateId = Number(filters.template.value)
    } else {
      qs.templateCode = filters.template.value
    }
  }

  return qs
}

export const recognitionJobHandlers = {
  start,
  get,
  getAll,
  getDescendants,
  getResult,
  downloadFile
}
