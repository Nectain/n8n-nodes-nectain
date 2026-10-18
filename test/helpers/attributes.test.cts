import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {NodeOperationError} from 'n8n-workflow'

import {parseAttributesJson, toAttributeValues} from '../../nodes/Nectain/helpers/attributes'
import {NODE} from '../_context.cjs'

const TYPES = new Map([
  ['amount', 'number'],
  ['subject', 'text'],
  ['dueDate', 'dateTime'],
  ['supplier', 'reference'],
  ['approvers', 'multipleReferences'],
  ['contract', 'hyperlink']
])

const CONTRACT_URL = 'https://example.com/contract.pdf'

describe('toAttributeValues', () => {
  it('sends numbers, text, and dates as they are', () => {
    const values = {
      amount: 1250.5,
      subject: 'Office paper',
      dueDate: '2026-09-25T14:30:00.000+03:00'
    }

    assert.deepEqual(toAttributeValues(values, TYPES), values)
  })

  it('sends a reference by code, or by ID when the value is a number', () => {
    assert.deepEqual(
      toAttributeValues({supplier: 'finance-dept'}, TYPES),
      {supplier: {code: 'finance-dept'}}
    )
    assert.deepEqual(
      toAttributeValues({supplier: '42'}, TYPES),
      {supplier: {id: 42}}
    )
  })

  it('sends multiple references from a comma-separated list', () => {
    assert.deepEqual(
      toAttributeValues({approvers: '42, finance-dept,,'}, TYPES),
      {approvers: [{id: 42}, {code: 'finance-dept'}]}
    )
  })

  it('sends a hyperlink with its URL as the caption', () => {
    assert.deepEqual(
      toAttributeValues({contract: CONTRACT_URL}, TYPES),
      {contract: {url: CONTRACT_URL, caption: CONTRACT_URL}}
    )
  })

  it('leaves out empty values', () => {
    const values = {
      subject: '',
      amount: null,
      supplier: undefined
    }

    assert.deepEqual(toAttributeValues(values, TYPES), {})
  })
})

describe('parseAttributesJson', () => {
  it('keeps the attributes object of the API unchanged', () => {
    const json = `{"contract":{"url":"${CONTRACT_URL}","caption":"Signed contract"}}`

    assert.deepEqual(parseAttributesJson(NODE, json, 0), {
      contract: {url: CONTRACT_URL, caption: 'Signed contract'}
    })
  })

  it('takes an object that an expression produced', () => {
    assert.deepEqual(
      parseAttributesJson(NODE, {amount: 1250.5}, 0),
      {amount: 1250.5}
    )
  })

  it('rejects text that is not valid JSON', () => {
    assert.throws(() => parseAttributesJson(NODE, '{"amount": }', 2), (error: unknown) => {
      assert.ok(error instanceof NodeOperationError)
      assert.equal(error.message, 'The attributes are not valid JSON')
      assert.equal(error.context.itemIndex, 2)

      return true
    })
  })
})
