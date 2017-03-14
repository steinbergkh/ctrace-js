'use strict'

const opentracing = require('opentracing')
let tracer

// Default name builder for operation name
function methodUrlNameBuilder (req) {
  return `${req.method}-${req.originalUrl}`
}
/**
 *
 * @param {Object} [opts]
 * @param {Function} [opts.nameBuilder]
 * @returns {Function}
 */
// todo: allow tracer to be passed in as option
function expressMiddleware (opts) {
  opts = opts || {}
  let nameBuilder = opts.nameBuilder || methodUrlNameBuilder

  return function handle (req, res, next) {
    // overwrites the res.write function to save body before sending response
    let write = res.write
    let body = {}
    res.write = function (chunk) {
      if (~res.getHeader('Content-Type').indexOf('application/json')) {
        chunk instanceof Buffer && (chunk = chunk.toString())
        try {
          let tempBody = chunk.toString()
          body = JSON.parse(tempBody)
        } catch (err) { console.log(err) }
      }
      write.apply(this, arguments)
    }

    if (!tracer) {
      tracer = opentracing.globalTracer()
    }
    const context = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers)
    let name = nameBuilder(req)
    let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl

    const span = tracer.startSpan(name, {
      childOf: context,
      tags: {
        'span.kind': 'server',
        'component': 'ctrace-express',
        'peer.hostname': req.hostname,
        'http.remote_addr': req.ip,
        'http.method': req.method,
        'http.url': fullUrl
      }
    })
    req.span = span

    res.on('finish', function () {
      if (res.statusCode >= 400) {
        span.addTags({
          'http.status_code': res.statusCode,
          'error': true
        })
        span.log({event: 'error', 'http.response_body': body})
      } else {
        span.addTags({'http.status_code': res.statusCode})
      }
      span.finish()
    })

    next()
  }
}

module.exports = expressMiddleware
