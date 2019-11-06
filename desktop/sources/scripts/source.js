'use strict'

function Source (terminal) {
  const fs = require('fs')
  const path = require('path')
  const electron = require('electron')
  const dialog = electron ? electron.remote.dialog : null
  const app = electron ? electron.remote.app : null

  this.path = null
  this.queue = []

  this.start = function () {
    this.increment()
    this.new()
  }

  this.new = function () {
    console.log('Source', 'Make a new file..')
    this.path = null
    this.queue = []
    terminal.orca.reset()
    terminal.resize()
    terminal.history.reset()
    terminal.cursor.reset()
    terminal.clock.play()
  }

  this.open = function () {
    console.log('Source', 'Open a file..')
    const paths = dialog.showOpenDialogSync(app.win, { properties: ['openFile'], filters: [{ name: 'Orca Machines', extensions: ['orca'] }] })
    if (!paths) { console.log('Nothing to load'); return }
    this.read(paths[0])
    terminal.toggleGuide(false)
  }

  this.save = function (quitAfter = false) {
    console.log('Source', 'Saving file..')
    if (!require('electron')) {
      this.download('orca', 'orca', this.generate(), 'text/plain')
    } else if (this.path) {
      this.write(this.path, this.generate(), quitAfter)
    } else {
      this.saveAs(quitAfter)
    }
  }

  this.saveAs = function (quitAfter = false) {
    console.log('Source', 'Save a file as..')
    const path = dialog.showSaveDialogSync(app.win, { filters: [{ name: 'Orca Machines', extensions: ['orca'] }] })
    if (!path) { console.log('Nothing to save'); return }
    this.write(path.indexOf('.orca') < 0 ? path + '.orca' : path, this.generate(), quitAfter)
    console.log('Source', 'Saved ' + path)
    this.path = path
  }

  this.download = (name, ext, content, type, settings = 'charset=utf-8') => {
    const link = document.createElement('a')
    link.setAttribute('download', `${name}-${timestamp()}.${ext}`)
    if (type === 'image/png' || type === 'image/jpeg') {
      link.setAttribute('href', content)
    } else {
      link.setAttribute('href', 'data:' + type + ';' + settings + ',' + encodeURIComponent(content))
    }
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  }

  this.revert = function () {
    if (!this.path) { return }
    console.log('Source', 'Revert a file..')
    this.read(this.path)
  }

  this.inject = function (name, paste = false) {
    if (!this.path) { console.warn('Source', 'Not in a project.'); return }
    const loc = path.join(this.folder(), name + '.orca')
    if (!fs.existsSync(loc)) { return }
    const data = fs.readFileSync(loc, 'utf8')
    if (!data) { return }
    const lines = data.split('\n')
    if (paste === true) {
      terminal.cursor.writeBlock(lines)
      terminal.cursor.reset()
    } else {
      terminal.cursor.resize(lines[0].length, lines.length)
    }
  }

  // I/O

  this.write = function (loc, data = this.generate(), quitAfter = false) {
    console.log('Source', 'Writing ' + loc)
    fs.writeFileSync(loc, data)
    terminal.source.remember('active', loc)
    if (quitAfter === true) {
      app.exit()
    }
  }

  this.read = function (loc = this.path, content = '') {
    if (!loc) { return }
    if (!fs && !content) { console.warn('Source', 'FileSystem unavailable'); return }
    if (!fs && content) { this.load(content); return }
    if (!fs.existsSync(loc)) { console.warn('Source', 'File does not exist: ' + loc); return }
    console.log('Source', 'Reading ' + loc)
    this.path = loc
    this.remember('active', this.path)
    this.load(fs.readFileSync(this.path, 'utf8'))

    // Look for queue
    const queue = path.join(this.folder(), this.name() + '.queue')
    if (fs.existsSync(queue)) {
      this.queue = fs.readFileSync(queue, 'utf8').split('\n')
      terminal.clock.setFrame(0)
      console.log('Source', `Found Queue: ${this.queue.length} lines`)
    }
  }

  this.run = function () {
    if (!this.queue || this.queue.length < terminal.orca.f || !this.queue[terminal.orca.f]) { return }
    terminal.commander.trigger(this.queue[terminal.orca.f])
  }

  this.load = function (data) {
    const lines = data.split('\n').map((line) => { return clean(line) })
    const w = lines[0].length
    const h = lines.length
    const s = lines.join('\n').trim()

    terminal.orca.load(w, h, s)
    terminal.history.reset()
    terminal.history.record(terminal.orca.s)
    terminal.fit()
  }

  this.quit = function () {
    if (this.hasChanges() === true) {
      this.verify()
    } else {
      app.exit()
    }
  }

  this.verify = function () {
    const response = dialog.showMessageBoxSync(app.win, {
      type: 'question',
      buttons: ['Cancel', 'Discard', 'Save'],
      title: 'Confirm',
      message: 'Unsaved data will be lost. Would you like to save your changes before leaving?',
      icon: path.join(__dirname, '../icon.png')
    })
    if (response === 2) {
      this.save(true)
    } else if (response === 1) {
      app.exit()
    }
  }

  this.hasChanges = function () {
    console.log('Source', 'Looking for changes..')
    if (!this.path) {
      console.log('Source', 'File is unsaved..')
      if (terminal.orca.length() > 2) {
        console.log('Source', 'File is not empty.')
        return true
      }
    } else {
      if (fs.existsSync(this.path)) {
        console.log('Source', 'Comparing with last saved copy..')
        const diff = isDifferent(fs.readFileSync(this.path, 'utf8'), this.generate())
        if (diff === true) {
          console.log('Source', 'File has been changed.')
          return true
        }
      } else {
        console.log('Source', 'File does not exist.')
        return true
      }
    }
  }

  // LocalStorage

  this.resume = function () {
    this.read(this.recall('active'))
  }

  this.remember = function (key, val) {
    if (!key || !val) { return }
    console.log('Source', `Remember: ${key}=${val}`)
    localStorage.setItem(key, val)
  }

  this.recall = function (key) {
    if (!key) { return }
    if (localStorage.hasOwnProperty(key)) {
      console.log('Source', `Recall: ${key}`)
      return localStorage.getItem(key)
    }
  }

  this.forget = function (key) {
    if (!key) { return }
    console.log('Source', `Forget: ${key}`)
    localStorage.removeItem(key)
  }

  this.increment = function () {
    const val = this.recall('session')
    this.remember('session', isNaN(val) ? 1 : parseInt(val) + 1)
  }

  // Converters

  this.generate = function (orca = terminal.orca) {
    return `${orca}`
  }

  this.locate = function (name) {
    if (!this.path) { return }
    const loc = path.join(this.folder(), name)
    return fs.existsSync(loc) ? loc : null
  }

  // Etc

  this.name = function () {
    return this.path ? path.basename(this.path, '.orca') : null
  }

  this.folder = function () {
    return this.path ? path.dirname(this.path) : null
  }

  this.toString = function () {
    return this.path ? this.name() : 'unsaved'
  }

  function isDifferent (a, b) {
    return a.replace(/[^a-zA-Z0-9+]+/gi, '').trim() !== b.replace(/[^a-zA-Z0-9+]+/gi, '').trim()
  }

  function clean (s) {
    let c = ''
    for (let x = 0; x <= s.length; x++) {
      const char = s.charAt(x)
      c += !terminal.orca.isAllowed(char) ? '.' : char
    }
    return c
  }

  function timestamp (d = new Date(), e = new Date(d)) {
    const ms = e - d.setHours(0, 0, 0, 0)
    return (ms / 8640 / 10000).toFixed(6).substr(2, 6)
  }
}
