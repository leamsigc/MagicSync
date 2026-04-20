#!/usr/bin/env node

import * as jose from 'jose';

const access = process.argv[2] || 'rw';

const keyPair = await jose.generateKeyPair('Ed25519');

const publicKeyJWK = await jose.exportJWK(keyPair.publicKey);

console.log('Public Key (SQLD_AUTH_JWT_KEY):');
console.log(publicKeyJWK.x);

const jwt = await new jose.SignJWT({ a: access })
  .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
  .setIssuedAt()
  .sign(keyPair.privateKey);

console.log('\nJWT (NUXT_TURSO_AUTH_TOKEN):');
console.log(jwt);
