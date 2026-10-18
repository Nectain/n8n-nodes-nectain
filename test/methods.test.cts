import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {listSearch, loadOptions, resourceMapping} from '../nodes/Nectain/methods'

import {apiRequest, createLoadOptionsContext, jsonResponse, NOT_FOUND} from './_context.cjs'

const INVOICE_TYPE = {
  __rl: true,
  mode: 'list',
  value: 'invoice',
  cachedResultName: 'Invoice'
}

const TEMPLATES = [
  {
    allowedDocTypes: [{code: 'incomingInvoice', id: 3000000201}],
    code: 'invoices',
    description: null,
    id: 3000000101,
    isMultiDoc: false,
    name: 'Invoices'
  },
  {
    allowedDocTypes: null,
    code: 'mixed-scans',
    description: 'Scanned packs of several documents',
    id: 3000000102,
    isMultiDoc: true,
    name: 'Mixed scans'
  }
]

function field (id: string, displayName: string, type: string) {
  return {
    id,
    displayName,
    type,
    required: false,
    defaultMatch: false,
    canBeUsedToMatch: false,
    display: true
  }
}

function role (id: number, code: string, name: string, allowMultiple: boolean) {
  return {
    allowGroups: allowMultiple,
    allowMultiple,
    id,
    role: {code, description: null, id: id + 33, name}
  }
}

describe('list search', () => {
  it('lists the creatable document types whose name or code contains the typed text', async () => {
    const {ctx, requests} = createLoadOptionsContext({}, [
      jsonResponse([
        {code: 'contract', id: 12, name: 'Contract'},
        {code: 'invoice', id: 7, name: 'Invoice'},
        {code: 'act', id: 15, name: 'Incoming act'}
      ])
    ])

    const result = await listSearch.searchDocumentTypes.call(ctx, 'IN')

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types',
        qs: {onlyCreatable: true}
      })
    ])
    assert.deepEqual(result, {
      results: [
        {name: 'Invoice', value: 'invoice'},
        {name: 'Incoming act', value: 'act'}
      ]
    })
  })

  it('lists the recognition templates by name with the code as the value', async () => {
    const {ctx} = createLoadOptionsContext({}, [jsonResponse(TEMPLATES)])

    const result = await listSearch.searchRecognitionTemplates.call(ctx)

    assert.deepEqual(result, {
      results: [
        {name: 'Invoices', value: 'invoices'},
        {name: 'Mixed scans', value: 'mixed-scans'}
      ]
    })
  })

  it('returns no recognition templates when the installation has no recognition', async () => {
    const {ctx} = createLoadOptionsContext({}, [NOT_FOUND])

    const result = await listSearch.searchRecognitionTemplates.call(ctx)

    assert.deepEqual(result, {results: []})
  })
})

describe('participant roles', () => {
  it('lists the roles of the chosen document type by name with the code as the value', async () => {
    const {ctx, requests} = createLoadOptionsContext({documentType: INVOICE_TYPE}, [
      jsonResponse({
        roles: [
          role(11, 'author', 'Author', false),
          role(12, 'approver', 'Approver', true)
        ]
      })
    ])

    const roles = await loadOptions.getRoles.call(ctx)

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types/invoice',
        qs: {by: 'code', select: 'roles'}
      })
    ])
    assert.deepEqual(roles, [
      {name: 'Author', value: 'author'},
      {name: 'Approver', value: 'approver'}
    ])
  })

  it('lists no roles before a document type is chosen', async () => {
    const {ctx, requests} = createLoadOptionsContext({
      documentType: {__rl: true, mode: 'list', value: ''}
    }, [])

    assert.deepEqual(await loadOptions.getRoles.call(ctx), [])
    assert.equal(requests.length, 0)
  })
})

describe('attribute fields', () => {
  it('offers the attributes a document can be created with, typed by their data type', async () => {
    const {ctx, requests} = createLoadOptionsContext({
      documentType: {__rl: true, mode: 'id', value: '7'}
    }, [
      jsonResponse({
        attributes: [
          {
            code: 'amount',
            constraints: {maximum: 1000000, minimum: 0},
            dataType: 'number',
            id: 1421,
            name: 'Amount'
          },
          {code: 'dueDate', dataType: 'dateTime', id: 1422, name: 'Due Date'},
          {code: 'paid', dataType: 'boolean', id: 1423, name: 'Paid'},
          {
            code: 'subject',
            constraints: {maxLength: 256},
            dataType: 'text',
            id: 1420,
            name: 'Subject'
          },
          {code: 'notes', dataType: 'richText', id: 1424, name: 'Notes'},
          {code: 'contract', dataType: 'hyperlink', id: 1425, name: 'Contract'},
          {
            code: 'supplier',
            dataType: 'reference',
            id: 1426,
            name: 'Supplier',
            reference: {dictionary: {code: 'suppliers', id: 301}, kind: 'userDictionary'}
          },
          {code: 'approvers', dataType: 'multipleReferences', id: 1427, name: 'Approvers'},
          {code: 'lines', dataType: 'collection', id: 1431, name: 'Invoice Lines'},
          {code: 'scan', dataType: 'file', id: 1432, name: 'Scan'},
          {code: 'appendices', dataType: 'fileCollection', id: 1433, name: 'Appendices'}
        ]
      })
    ])

    const result = await resourceMapping.getAttributes.call(ctx)

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types/7',
        qs: {select: 'attributes'}
      })
    ])
    assert.deepEqual(result, {
      fields: [
        field('amount', 'Amount', 'number'),
        field('dueDate', 'Due Date', 'dateTime'),
        field('paid', 'Paid', 'boolean'),
        field('subject', 'Subject', 'string'),
        field('notes', 'Notes', 'string'),
        field('contract', 'Contract', 'string'),
        field('supplier', 'Supplier', 'string'),
        field('approvers', 'Approvers', 'string')
      ]
    })
  })

  it('offers no fields and a notice before a document type is chosen', async () => {
    const {ctx, requests} = createLoadOptionsContext({}, [])

    const result = await resourceMapping.getAttributes.call(ctx)

    assert.deepEqual(result, {
      fields: [],
      emptyFieldsNotice: 'Choose a document type to map its attributes'
    })
    assert.equal(requests.length, 0)
  })
})
