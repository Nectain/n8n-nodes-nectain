import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {NectainApi} from '../credentials/NectainApi.credentials'

describe('NectainApi credential', () => {
  const credential = new NectainApi()

  it('stores the API key as a password', () => {
    const apiKey = credential
      .properties
      .find(property => property.name === 'apiKey')

    assert.equal(apiKey?.typeOptions?.password, true)
  })

  it('sends the API key as a Bearer token', () => {
    assert.deepEqual(credential.authenticate.properties.headers, {
      Authorization: '=Bearer {{$credentials.apiKey}}'
    })
  })

  it('tests the credential by listing document types', () => {
    assert.deepEqual(credential.test.request, {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v1/document-types'
    })
  })
})
