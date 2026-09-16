import { createPrivateKey, randomUUID, sign } from 'node:crypto'

export interface ServiceJwtSignerConfig {
  readonly privateKey: string
  readonly keyId: string
  readonly issuer: string
  readonly audience: string
}

export function serviceJwtSignerConfig(env: NodeJS.ProcessEnv): ServiceJwtSignerConfig {
  const config = {
    privateKey: env.SERVICE_JWT_PRIVATE_KEY ?? '',
    keyId: env.SERVICE_JWT_KEY_ID ?? '',
    issuer: env.SERVICE_JWT_ISSUER ?? '',
    audience: env.SERVICE_JWT_AUDIENCE ?? '',
  }
  if (Object.values(config).some((value) => !value.trim())) {
    throw new Error('SERVICE_JWT_PRIVATE_KEY, SERVICE_JWT_KEY_ID, SERVICE_JWT_ISSUER, and SERVICE_JWT_AUDIENCE are required')
  }
  return config
}

export async function createServiceJwt(config: ServiceJwtSignerConfig, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: config.keyId })
  const payload = encode({
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + 60,
    jti: randomUUID(),
  })
  const signingInput = `${header}.${payload}`
  const privateKey = createPrivateKey(config.privateKey.replace(/\\n/g, '\n'))
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')
  return `${signingInput}.${signature}`
}
