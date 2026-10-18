import type {IDataObject, IExecuteFunctions, INodeExecutionData} from 'n8n-workflow'

import {nectainRequest} from '../helpers/request'

async function getAll (this: IExecuteFunctions): Promise<INodeExecutionData[]> {
  const response = await nectainRequest(
    this,
    {
      method: 'GET',
      url: '/api/v1/recognition-templates'
    }
  )
  return (response.body as IDataObject[]).map(json => ({json}))
}

export const recognitionTemplateHandlers = {
  getAll
}
