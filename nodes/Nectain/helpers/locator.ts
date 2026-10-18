import type {IDataObject, INodeParameterResourceLocator} from 'n8n-workflow'

/**
 * Converts a resource locator to a reference of the API:
 * `{id}` in the ID mode, `{path}` in the path mode,
 * and `{code}` in the list and code modes, because the list mode stores the code.
 */
export function toReference (locator: INodeParameterResourceLocator): IDataObject {
  const value = String(locator.value)

  if (locator.mode === 'id') {
    return {id: Number(value)}
  }

  if (locator.mode === 'path') {
    return {path: value}
  }

  return {code: value}
}

export function isLocatorSet (
  locator: INodeParameterResourceLocator | undefined
): locator is INodeParameterResourceLocator {
  return locator !== undefined &&
    locator.value !== undefined &&
    locator.value !== null &&
    locator.value !== ''
}

/**
 * The path and query of `GET /api/v1/document-types/{key}` for a document type locator.
 */
export function documentTypeRequest (
  locator: INodeParameterResourceLocator
): {url: string, qs: IDataObject} {
  const url = `/api/v1/document-types/${encodeURIComponent(String(locator.value))}`

  return {
    url,
    qs: locator.mode === 'id'
      ? {}
      : {by: 'code'}
  }
}
