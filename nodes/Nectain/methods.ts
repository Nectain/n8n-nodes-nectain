import type {
  ILoadOptionsFunctions,
  INodeListSearchItems,
  INodeListSearchResult,
  INodeParameterResourceLocator,
  INodePropertyOptions,
  JsonObject,
  ResourceMapperFields
} from 'n8n-workflow'
import {NodeApiError} from 'n8n-workflow'

import {loadAttributes, toAttributeFields} from './helpers/attributes'
import {documentTypeRequest, isLocatorSet} from './helpers/locator'
import {nectainRequest} from './helpers/request'

interface Named {
  code: string
  name: string
}

/** The API has no search parameter for these lists, so the whole list is read and filtered here. */
function toSearchResults (entries: Named[], filter: string | undefined): INodeListSearchItems[] {
  const text = (filter ?? '').toLowerCase()

  return entries
    .filter(entry => (
      entry.name.toLowerCase().includes(text) ||
      entry.code.toLowerCase().includes(text)
    ))
    .map(entry => ({name: entry.name, value: entry.code}))
}

function chosenDocumentType (
  ctx: ILoadOptionsFunctions
): INodeParameterResourceLocator | undefined {
  const value = ctx.getCurrentNodeParameter('documentType')
  const documentType = value as INodeParameterResourceLocator | undefined

  return isLocatorSet(documentType) ? documentType : undefined
}

async function searchDocumentTypes (
  this: ILoadOptionsFunctions,
  filter?: string
): Promise<INodeListSearchResult> {
  const response = await nectainRequest(this, {
    method: 'GET',
    url: '/api/v1/document-types',
    qs: {onlyCreatable: true}
  })

  return {
    results: toSearchResults(response.body as Named[], filter)
  }
}

async function searchRecognitionTemplates (
  this: ILoadOptionsFunctions,
  filter?: string
): Promise<INodeListSearchResult> {
  try {
    const response = await nectainRequest(this, {
      method: 'GET',
      url: '/api/v1/recognition-templates'
    })

    return {
      results: toSearchResults(response.body as Named[], filter)
    }
  } catch (error) {
    // An installation without recognition support has no templates
    if (error instanceof NodeApiError && error.httpCode === '404') {
      return {results: []}
    }

    throw new NodeApiError(this.getNode(), error as JsonObject)
  }
}

async function getRoles (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const documentType = chosenDocumentType(this)
  if (documentType === undefined) {
    return []
  }

  const {url, qs} = documentTypeRequest(documentType)
  const response = await nectainRequest(this, {
    method: 'GET',
    url,
    qs: {...qs, select: 'roles'}
  })

  const {roles} = response.body as {roles: Array<{role: Named}>}
  return roles.map(({role}) => ({name: role.name, value: role.code}))
}

async function getAttributes (this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
  const documentType = chosenDocumentType(this)
  if (documentType === undefined) {
    return {
      fields: [],
      emptyFieldsNotice: 'Choose a document type to map its attributes'
    }
  }

  return {
    fields: toAttributeFields(await loadAttributes(this, documentType))
  }
}

export const listSearch = {
  searchDocumentTypes,
  searchRecognitionTemplates
}

export const loadOptions = {
  getRoles
}

export const resourceMapping = {
  getAttributes
}
