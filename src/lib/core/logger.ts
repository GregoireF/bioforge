// src/lib/core/logger.ts
// Logger léger — compatible Node, Edge et Vite bundle
// Remplace pino qui est Node-only et casse le build Vercel SSR

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:   LogLevel
  msg:     string
  time:    string
  [key: string]: unknown
}

const isDev  = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
const isProd = !isDev

function formatEntry(entry: LogEntry): string {
  if (isDev) {
    const { level, msg, time, ...rest } = entry
    const prefix = { debug: '🔍', info: '💬', warn: '⚠️', error: '❌' }[level]
    const extra  = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''
    return `${prefix} [${time}] ${msg}${extra}`
  }
  return JSON.stringify(entry)
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    msg,
    time: new Date().toISOString(),
    ...meta,
  }

  const formatted = formatEntry(entry)

  switch (level) {
    case 'debug': isDev && console.debug(formatted); break
    case 'info':  console.info(formatted);            break
    case 'warn':  console.warn(formatted);            break
    case 'error': console.error(formatted);           break
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}

export type Logger = typeof logger