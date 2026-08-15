type ErrorContext = Record<string, unknown>

const SERVICE = process.env.K_SERVICE || 'tower-management-demo'
const VERSION = process.env.K_REVISION || 'unknown'

/**
 * Logs an error as a structured JSON entry to stderr in the format Cloud
 * Run's logging agent forwards to Cloud Logging, and which Cloud Error
 * Reporting automatically scans for and groups — no extra client library,
 * service account role, or vendor account required beyond what Cloud Run
 * already has.
 *
 * https://cloud.google.com/error-reporting/docs/formatting-error-messages
 *
 * Usage in a route handler or server component:
 *   try { ... } catch (err) { reportError(err, { route: '/api/sites', siteId }) }
 */
export function reportError(error: unknown, context: ErrorContext = {}) {
  const err = error instanceof Error ? error : new Error(String(error))
  const payload = {
    severity: 'ERROR',
    message: `${err.message}\n${err.stack ?? ''}`,
    '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
    serviceContext: { service: SERVICE, version: VERSION },
    context,
  }
  // Cloud Run captures container stdout/stderr into Cloud Logging automatically.
  console.error(JSON.stringify(payload))
}
