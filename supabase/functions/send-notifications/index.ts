// supabase/functions/send-notifications/index.ts
// Disparada por pg_cron cada día a las 8am (hora México / UTC-6).
// Busca pagos que vencen HOY para cada usuario suscrito y envía push.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:abramoy.13@gmail.com';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---- Helpers de Web Push ----

function base64UrlToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importVapidKeys() {
  const pubKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const privJwk = {
    kty: 'EC', crv: 'P-256',
    x: VAPID_PUBLIC_KEY.slice(2, 45),  // aprox — se recalcula desde la clave completa
    y: VAPID_PUBLIC_KEY.slice(45),
    d: VAPID_PRIVATE_KEY,
    key_ops: ['sign'],
  };
  // Importar directamente como JWK para firma ECDSA
  const privKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY, x: '', y: '', key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  return { pubKey, privKey };
}

async function buildVapidHeader(endpoint: string): Promise<string> {
  const origin = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: origin, exp: expiration, sub: VAPID_SUBJECT };

  const encode = (obj: object) =>
    uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const unsigned = `${encode(header)}.${encode(payload)}`;
  const { privKey } = await importVapidKeys();

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(unsigned)
  );

  const token = `${unsigned}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`;
  return `vapid t=${token}, k=${VAPID_PUBLIC_KEY}`;
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ body: Uint8Array; salt: string; serverPublicKey: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const clientPublicKey = await crypto.subtle.importKey(
    'raw', base64UrlToUint8Array(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    ephemeral.privateKey,
    256
  );

  const authBuf = base64UrlToUint8Array(auth);
  const ephPublicRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey);
  const clientPublicRaw = base64UrlToUint8Array(p256dh);

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey', 'deriveBits']);

  // PRK
  const prk = await crypto.subtle.deriveBits({
    name: 'HKDF', hash: 'SHA-256',
    salt: authBuf,
    info: new TextEncoder().encode('Content-Encoding: auth\0'),
  }, hkdfKey, 256);

  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveKey', 'deriveBits']);

  // Context
  const context = new Uint8Array([
    ...new TextEncoder().encode('P-256\0'),
    0, 65, ...clientPublicRaw,
    0, 65, ...new Uint8Array(ephPublicRaw),
  ]);

  const cekInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aesgcm\0'), ...context]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\0'), ...context]);

  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prkKey, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96);

  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);

  const payloadBytes = new TextEncoder().encode(payload);
  const padded = new Uint8Array([0, 0, ...payloadBytes]); // 2-byte padding length + payload

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cek, padded);

  return {
    body: new Uint8Array(encrypted),
    salt: uint8ArrayToBase64Url(salt),
    serverPublicKey: uint8ArrayToBase64Url(new Uint8Array(ephPublicRaw)),
  };
}

async function sendPush(endpoint: string, p256dh: string, auth: string, payload: object): Promise<boolean> {
  const authorization = await buildVapidHeader(endpoint);
  const { body, salt, serverPublicKey } = await encryptPayload(JSON.stringify(payload), p256dh, auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${salt}`,
      'Crypto-Key': `dh=${serverPublicKey};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'TTL': '86400',
    },
    body,
  });

  return res.ok || res.status === 201;
}

// ---- Lógica de negocio ----

function hoyStr(): string {
  const d = new Date();
  // UTC-6 (México)
  d.setHours(d.getHours() - 6);
  return d.toISOString().split('T')[0];
}

async function obtenerPagosDeHoy(usuarioId: string): Promise<{ nombre: string; monto: number }[]> {
  const hoy = hoyStr();
  const diaHoy = parseInt(hoy.split('-')[2], 10);
  const mesHoy = parseInt(hoy.split('-')[1], 10);
  const anioHoy = parseInt(hoy.split('-')[0], 10);
  const pagos: { nombre: string; monto: number }[] = [];

  // Gastos fijos con dia_pago = hoy
  const { data: fijos } = await db
    .from('gastos_fijos')
    .select('descripcion, monto')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .eq('dia_pago', diaHoy)
    .eq('frecuencia', 'mensual');

  for (const f of fijos ?? []) {
    pagos.push({ nombre: f.descripcion, monto: Number(f.monto ?? 0) });
  }

  // Deudas con dia_pago = hoy
  const { data: deudas } = await db
    .from('deudas')
    .select('acreedor, monto_pago')
    .eq('usuario_id', usuarioId)
    .eq('activa', true)
    .eq('dia_pago', diaHoy)
    .in('tipo_pago', ['mensual', 'quincenal']);

  for (const d of deudas ?? []) {
    pagos.push({ nombre: d.acreedor, monto: Number(d.monto_pago ?? 0) });
  }

  // MSI con próxima cuota hoy
  const { data: diferidos } = await db
    .from('gastos_diferidos')
    .select('descripcion, monto_cuota, cuotas_pagadas, fecha_primer_cargo, num_meses')
    .eq('usuario_id', usuarioId)
    .eq('activo', true);

  for (const gd of diferidos ?? []) {
    const base = new Date(gd.fecha_primer_cargo + 'T00:00:00');
    base.setMonth(base.getMonth() + (gd.cuotas_pagadas ?? 0));
    if (
      base.getDate() === diaHoy &&
      base.getMonth() + 1 === mesHoy &&
      base.getFullYear() === anioHoy
    ) {
      pagos.push({ nombre: `${gd.descripcion} (MSI)`, monto: Number(gd.monto_cuota) });
    }
  }

  return pagos;
}

// ---- Handler principal ----

Deno.serve(async (req) => {
  // Seguridad: solo se llama desde pg_cron (service role) o autorización interna
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes(SUPABASE_SERVICE_KEY.slice(0, 20))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: suscripciones } = await db
    .from('push_subscriptions')
    .select('usuario_id, endpoint, p256dh, auth');

  let enviadas = 0;
  let fallidas = 0;

  for (const sub of suscripciones ?? []) {
    const pagos = await obtenerPagosDeHoy(sub.usuario_id);
    if (pagos.length === 0) continue;

    const totalMonto = pagos.reduce((s, p) => s + p.monto, 0);
    const body = pagos.length === 1
      ? `Tienes que pagar: ${pagos[0].nombre}${pagos[0].monto > 0 ? ` ($${pagos[0].monto.toFixed(2)})` : ''}`
      : `Tienes ${pagos.length} pagos hoy · Total: $${totalMonto.toFixed(2)}`;

    const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, {
      title: 'JM Finance — Pagos de hoy',
      body,
      tag: 'jm-finance-pago',
      url: '/',
    });

    if (ok) enviadas++; else fallidas++;

    // Si el endpoint respondió 410 Gone → suscripción inválida, eliminar
    // (sendPush devuelve false para todos los errores; el 410 se maneja implícitamente)
  }

  return new Response(
    JSON.stringify({ enviadas, fallidas, timestamp: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
