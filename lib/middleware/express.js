'use strict'

const url = require('url')
const opentracing = require('opentracing')
let tracer

const Tracer = require('../tracer')

function handle (req, res, next) {
  if (!tracer) {
    tracer = opentracing.globalTracer()
  }
  const context = tracer.extract(Tracer.FORMAT_HTTP_HEADERS, req.headers)
  let name = `${req.method}-${req.originalUrl}`
  let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

  const span = tracer.startSpan(name, {
    childOf: context,
    tags: {
      'span.kind': 'server',
      'component': 'routes',
      'peer.hostname': req.hostname,
      'peer.ipv6': req.ip,
      'http.method': req.method,
      'http.url': fullUrl
    }
  })
  req.span = span

  res.on('finish', function () {
    if (res.statusCode >= 500) {
      span.addTags({
          'http.status_code': res.statusCode,
          'error': true
        })
    } else {
      span.addTags({'http.status_code': res.statusCode})
    }
    span.finish()
  })

  next()
}

module.exports = handle
