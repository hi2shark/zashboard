import type { Proxy } from '@/types'

const normalizeTargetHost = (host: string) => host.trim().replace(/\.$/, '').toLowerCase()

const joinHostPort = (host: string, port: number) => {
  if (host.includes(':')) {
    return `[${host}]:${port}`
  }
  return `${host}:${port}`
}

export const splitHostPort = (addr: string): { host: string; port: number } | null => {
  const value = addr.trim()
  if (!value) return null

  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    if (end <= 1 || value[end + 1] !== ':') return null
    const host = normalizeTargetHost(value.slice(1, end))
    const port = Number(value.slice(end + 2))
    if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null
    return { host, port }
  }

  const idx = value.lastIndexOf(':')
  if (idx <= 0 || idx === value.length - 1) return null
  const host = normalizeTargetHost(value.slice(0, idx))
  const port = Number(value.slice(idx + 1))
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null
  return { host, port }
}

/** 把 `host:port` 规范成与 adaptive target.key 一致的 `tcp://host:port` / `udp://…`。 */
export const targetKeyFromAddr = (addr: string, network = 'tcp'): string | null => {
  const parsed = splitHostPort(addr)
  if (!parsed) return null
  if (network !== 'tcp' && network !== 'udp') return null
  return `${network}://${joinHostPort(parsed.host, parsed.port)}`
}

/**
 * 从 /proxies 反查：dialer-proxy 指向 group，且 addr 对应 targetKey 的出口代理名。
 * 多个同址出口用 `, ` 拼接；无匹配返回 null。
 */
export const resolveExitNamesForTarget = (
  proxyMap: Record<string, Proxy>,
  groupName: string,
  targetKey: string,
): string | null => {
  if (!groupName || !targetKey || targetKey === 'global') return null

  const network = targetKey.startsWith('udp://')
    ? 'udp'
    : targetKey.startsWith('tcp://')
      ? 'tcp'
      : null
  if (!network) return null

  const names: string[] = []
  for (const proxy of Object.values(proxyMap)) {
    if (proxy['dialer-proxy'] !== groupName) continue
    if (!proxy.addr) continue
    const key = targetKeyFromAddr(proxy.addr, network)
    if (key === targetKey) {
      names.push(proxy.name)
    }
  }

  if (!names.length) return null
  names.sort((a, b) => a.localeCompare(b))
  return names.join(', ')
}
