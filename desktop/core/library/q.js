'use strict'

const Operator = require('../operator')

function OperatorQ (orca, x, y, passive) {
  Operator.call(this, orca, x, y, 'q', passive)

  this.name = 'query'
  this.info = 'Reads distant operators with offset.'
  this.draw = false

  this.ports.haste.x = { x: -3, y: 0 }
  this.ports.haste.y = { x: -2, y: 0 }
  this.ports.haste.len = { x: -1, y: 0 }
  this.ports.output = { x: 0, y: 1 }

  this.haste = function () {
    this.ports.input = []
    this.len = clamp(this.listen(this.ports.haste.len, true), 1, 16)
    const _x = this.listen(this.ports.haste.x, true)
    const _y = this.listen(this.ports.haste.y, true)
    for (let i = 1; i <= this.len; i++) {
      this.ports.input.push({ x: i + _x, y: _y })
      orca.lock(this.x + this.ports.output.x + i - this.len, this.y + 1)
    }
  }

  this.run = function () {
    // Read
    let str = ''
    for (const id in this.ports.input) {
      const port = this.ports.input[id]
      const val = this.listen(port)
      str += val
    }
    // Write
    for (let i = 0; i < str.length; i++) {
      orca.write(this.x + this.ports.output.x + i - str.length + 1, this.y + this.ports.output.y, str[i])
    }
  }

  function clamp (v, min, max) { return v < min ? min : v > max ? max : v }
}

module.exports = OperatorQ
