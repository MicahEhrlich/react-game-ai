import { randomUUID } from 'node:crypto'
import { importPKCS8, SignJWT } from 'jose'

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
  const privateKey = await importPKCS8(config.privateKey.replace(/\\n/g, '\n'), 'RS256')
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: config.keyId })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .setJti(randomUUID())
    .sign(privateKey)
}
