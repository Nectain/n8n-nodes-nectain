import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeParameterResourceLocator
} from 'n8n-workflow'

import {documentTypeRequest, isLocatorSet} from '../helpers/locator'
import {nectainRequest, selectQuery} from '../helpers/request'

interface GetManyFilters {
  onlyCreatable?: boolean
  folder?: INodeParameterResourceLocator
}

async function get (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const documentType = this.getNodeParameter(
    'documentType',
    itemIndex
  ) as INodeParameterResourceLocator
  const options = this.getNodeParameter('options', itemIndex) as {select?: string}
  const {url, qs} = documentTypeRequest(documentType)
  const response = await nectainRequest(this, {
    method: 'GET',
    url,
    qs: {...qs, ...selectQuery(options)}
  })

  return [{
    json: response.body as IDataObject
  }]
}

async function getAll (this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
  const filters = this.getNodeParameter('filters', itemIndex) as GetManyFilters
  const qs: IDataObject = {}

  if (filters.onlyCreatable !== undefined) {
    qs.onlyCreatable = filters.onlyCreatable
  }

  if (isLocatorSet(filters.folder)) {
    if (filters.folder.mode === 'id') {
      qs['folder.id'] = filters.folder.value
    } else {
      qs['folder.path'] = filters.folder.value
    }
  }

  const response = await nectainRequest(this, {
    method: 'GET',
    url: '/api/v1/document-types',
    qs
  })

  return (response.body as IDataObject[]).map(json => ({json}))
}

export const documentTypeHandlers = {
  get,
  getAll
}
