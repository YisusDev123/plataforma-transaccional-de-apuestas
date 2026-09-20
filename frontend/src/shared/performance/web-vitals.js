import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

const measurements = {}

function record(metric) {
  measurements[metric.name] = {
    value: Number(metric.value.toFixed(2)),
    rating: metric.rating,
    navigationType: metric.navigationType,
  }
}

Object.defineProperty(window, '__Loto_WEB_VITALS__', {
  configurable: false,
  enumerable: false,
  value: measurements,
})

const options = { reportAllChanges: true }
onCLS(record, options)
onFCP(record, options)
onINP(record, options)
onLCP(record, options)
onTTFB(record, options)
