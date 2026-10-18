import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {IDataObject} from 'n8n-workflow'

import {fetchAll} from '../../nodes/Nectain/helpers/pagination'
import {apiRequest, createExecuteContext, jsonResponse} from '../_context.cjs'

const JOBS = '/api/v1/recognition-jobs'

function job (id: number, status = 'error'): IDataObject {
  return {id, status}
}

function page (items: IDataObject[], next: string | null) {
  return jsonResponse({
    items,
    pagination: {offset: 0, limit: 1000, next, previous: null}
  })
}

describe('fetchAll', () => {
  it('follows pagination.next with Return All and keeps the order of both pages', async () => {
    const next = `${JOBS}?status=error&offset=1000&limit=1000`
    const {ctx, requests} = createExecuteContext({
      parameters: {},
      responses: [
        page([job(1), job(2)], next),
        page([job(3)], null)
      ]
    })

    const items = await fetchAll(ctx, JOBS, {status: 'error'}, {returnAll: true, limit: 0})

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: JOBS,
        qs: {status: 'error', limit: 1000}
      }),
      apiRequest({
        method: 'GET',
        url: next
      })
    ])
    assert.deepEqual(items, [job(1), job(2), job(3)])
  })

  it('requests one page of Limit items when Limit is smaller than a page', async () => {
    const jobs = [job(1), job(2), job(3), job(4), job(5)]
    const {ctx, requests} = createExecuteContext({
      parameters: {},
      responses: [page(jobs, `${JOBS}?offset=5&limit=5`)]
    })

    const items = await fetchAll(ctx, JOBS, {}, {returnAll: false, limit: 5})

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: JOBS,
        qs: {limit: 5}
      })
    ])
    assert.deepEqual(items, jobs)
  })

  it('caps the page size at 1000 for a larger Limit', async () => {
    const {ctx, requests} = createExecuteContext({
      parameters: {},
      responses: [page([], null)]
    })

    await fetchAll(ctx, JOBS, {}, {returnAll: false, limit: 2500})

    assert.deepEqual(requests[0].qs, {limit: 1000})
  })

  it('outputs once an item that adjacent pages repeat', async () => {
    const {ctx} = createExecuteContext({
      parameters: {},
      responses: [
        page([job(1), job(2)], `${JOBS}?offset=2&limit=2`),
        page([job(2), job(3)], null)
      ]
    })

    const items = await fetchAll(ctx, JOBS, {}, {returnAll: true, limit: 0})

    assert.deepEqual(items, [job(1), job(2), job(3)])
  })

  it('keeps every item when the selected fields leave out id', async () => {
    const {ctx} = createExecuteContext({
      parameters: {},
      responses: [page([{status: 'error'}, {status: 'error'}], null)]
    })

    const items = await fetchAll(ctx, JOBS, {select: 'status'}, {returnAll: true, limit: 0})

    assert.deepEqual(items, [{status: 'error'}, {status: 'error'}])
  })
})
