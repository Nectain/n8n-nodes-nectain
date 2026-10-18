import type {IDataObject} from 'n8n-workflow'

import type {NectainContext, NectainRequest} from './request'
import {nectainRequest} from './request'

/** The maximum `limit` of the paginated list operations in the OpenAPI document. */
const MAX_PAGE_SIZE = 1000

interface Page {
  items: IDataObject[]
  pagination: {next: string | null}
}

export interface PageOptions {
  returnAll: boolean
  limit: number
}

/**
 * Reads a paginated list by following `pagination.next`
 * until it is `null` or `limit` items are read.
 * Adjacent pages can repeat an item, so an item whose `id` was already read is dropped;
 * items without `id`, which a `select` can produce, are all kept.
 */
export async function fetchAll (
  ctx: NectainContext,
  url: string,
  qs: IDataObject,
  {returnAll, limit}: PageOptions
): Promise<IDataObject[]> {
  const pageSize = returnAll
    ? MAX_PAGE_SIZE
    : Math.min(limit, MAX_PAGE_SIZE)
  let request: NectainRequest | undefined = {
    method: 'GET',
    url,
    qs: {...qs, limit: pageSize}
  }

  const items: IDataObject[] = []
  const seen = new Set<unknown>()
  while (request !== undefined) {
    const page = (await nectainRequest(ctx, request)).body as Page
    for (const item of page.items) {
      if (item.id !== undefined) {
        if (seen.has(item.id)) {
          continue
        }
        seen.add(item.id)
      }

      items.push(item)
      if (!returnAll && items.length >= limit) {
        return items
      }
    }

    // A root-relative link that repeats the filters and `select` of the first request
    request = page.pagination.next === null
      ? undefined
      : {method: 'GET', url: page.pagination.next}
  }

  return items
}
