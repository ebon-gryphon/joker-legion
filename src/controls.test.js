import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'vue/compiler-sfc'

const components = new URL('./', import.meta.url)
const skins = new Set([
  'key-command', 'key-ink', 'key-tab', 'key-index', 'key-price', 'key-link',
  'key-ticket', 'key-face', 'key-close', 'key-stall', 'key-chit', 'key-portrait',
  'key-hand', 'key-court', 'key-select', 'key-disclosure',
])

test('every Legion button, selector and disclosure uses a game control skin', () => {
  const missing = []
  for (const file of readdirSync(components).filter(name => name.endsWith('.vue'))) {
    const source = readFileSync(new URL(file, components), 'utf8')
    const { descriptor, errors } = parse(source, { filename: file })
    assert.deepEqual(errors, [])
    function inspect(node) {
      if (['button', 'select', 'summary'].includes(node.tag)) {
        const classes = node.props.find(prop => prop.name === 'class')?.value?.content.split(/\s+/) || []
        if (!classes.some(name => skins.has(name))) missing.push(file + ':' + node.loc.start.line)
      }
      for (const child of node.children || []) if (typeof child === 'object') inspect(child)
    }
    inspect(descriptor.template.ast)
  }
  assert.deepEqual(missing, [])
})
