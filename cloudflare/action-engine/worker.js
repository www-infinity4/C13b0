const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://www-infinity4.github.io')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || 'https://www-infinity4.github.io';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-infinity-connector,x-infinity-ledger-receipt',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function response(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(request, env) },
  });
}

function fail(request, env, status, error, detail) {
  return response(request, env, { ok: false, error, detail }, status);
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('content-type must be application/json');
  return request.json();
}

function connectorAllowed(request, env) {
  if (!env.INFINITY_CONNECTOR_SECRET) return false;
  return request.headers.get('x-infinity-connector') === env.INFINITY_CONNECTOR_SECRET;
}

function ledgerReceiptAllowed(request, env) {
  if (!env.LEDGER_RECEIPT_SECRET) return false;
  return request.headers.get('x-infinity-ledger-receipt') === env.LEDGER_RECEIPT_SECRET;
}

function text(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function saveBusinessSite(request, env) {
  if (!connectorAllowed(request, env)) return fail(request, env, 401, 'connector_auth_required');
  const body = await readJson(request);
  const now = new Date().toISOString();
  const id = text(body.id || newId('business'), 180);
  const actorId = text(body.actorId, 180);
  const ownerWalletId = text(body.ownerWalletId, 180);
  const websiteTokenId = text(body.websiteTokenId, 180);
  const businessName = text(body.businessName, 240);
  const siteType = text(body.siteType || 'Product page', 120);
  const description = text(body.description, 5000);
  const researchQuery = text(body.researchQuery, 2000);
  const styleFingerprint = text(body.styleFingerprint, 240);
  if (!actorId || !ownerWalletId || !websiteTokenId || !businessName || !styleFingerprint) {
    return fail(request, env, 400, 'missing_required_business_fields');
  }

  const styleProfile = JSON.stringify(body.styleProfile || {});
  const sectionPlan = JSON.stringify(Array.isArray(body.sectionPlan) ? body.sectionPlan : []);
  await env.DB.prepare(`
    INSERT INTO business_sites (
      id, actor_id, owner_wallet_id, website_token_id, business_name, site_type,
      description, research_query, style_fingerprint, style_profile_json,
      section_plan_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    ON CONFLICT(website_token_id) DO UPDATE SET
      business_name = excluded.business_name,
      site_type = excluded.site_type,
      description = excluded.description,
      research_query = excluded.research_query,
      style_fingerprint = excluded.style_fingerprint,
      style_profile_json = excluded.style_profile_json,
      section_plan_json = excluded.section_plan_json,
      updated_at = excluded.updated_at
  `).bind(
    id, actorId, ownerWalletId, websiteTokenId, businessName, siteType,
    description, researchQuery, styleFingerprint, styleProfile, sectionPlan, now, now
  ).run();

  const runId = newId('style');
  await env.DB.prepare(`
    INSERT INTO business_style_runs (
      id, business_site_id, style_fingerprint, style_name, history_terms_json,
      section_plan_json, variation_nonce, created_at
    ) VALUES (?, (SELECT id FROM business_sites WHERE website_token_id = ?), ?, ?, ?, ?, ?, ?)
  `).bind(
    runId,
    websiteTokenId,
    styleFingerprint,
    text(body.styleProfile?.name || 'Unspecified', 180),
    JSON.stringify(Array.isArray(body.styleProfile?.historyTerms) ? body.styleProfile.historyTerms : []),
    sectionPlan,
    Number.isSafeInteger(Number(body.styleProfile?.variationNonce)) ? Number(body.styleProfile.variationNonce) : 0,
    now
  ).run();

  return response(request, env, { ok: true, id, websiteTokenId, styleRunId: runId, status: 'draft' }, 201);
}

async function saveStorefrontConnector(request, env) {
  if (!connectorAllowed(request, env)) return fail(request, env, 401, 'connector_auth_required');
  const body = await readJson(request);
  const now = new Date().toISOString();
  const id = text(body.id || newId('storefront'), 180);
  const businessSiteId = text(body.businessSiteId, 180);
  const ownerWalletId = text(body.ownerWalletId, 180);
  const provider = text(body.provider, 100);
  const storefrontUrl = text(body.storefrontUrl, 2000);
  const mode = ['link', 'catalog-import', 'publish-sync'].includes(body.mode) ? body.mode : 'link';
  if (!businessSiteId || !ownerWalletId || !provider || !storefrontUrl) {
    return fail(request, env, 400, 'missing_required_storefront_fields');
  }

  let parsed;
  try { parsed = new URL(storefrontUrl); } catch { return fail(request, env, 400, 'invalid_storefront_url'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) return fail(request, env, 400, 'invalid_storefront_protocol');

  await env.DB.prepare(`
    INSERT INTO storefront_connectors (
      id, business_site_id, owner_wallet_id, provider, storefront_url, mode,
      auth_state, sync_state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'not-connected', 'idle', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      storefront_url = excluded.storefront_url,
      mode = excluded.mode,
      updated_at = excluded.updated_at
  `).bind(id, businessSiteId, ownerWalletId, provider, parsed.toString(), mode, now, now).run();

  return response(request, env, {
    ok: true,
    id,
    authState: 'not-connected',
    syncState: 'idle',
    message: mode === 'link' ? 'Public storefront link recorded.' : 'Connector recorded; provider authorization is required before sync.',
  }, 201);
}

async function createTransferIntent(request, env) {
  if (!connectorAllowed(request, env)) return fail(request, env, 401, 'connector_auth_required');
  const body = await readJson(request);
  const now = new Date().toISOString();
  const senderWalletId = text(body.senderWalletId, 180);
  const recipientWalletId = text(body.recipientWalletId, 180);
  const actorId = text(body.actorId, 180);
  const websiteTokenId = text(body.websiteTokenId, 180);
  const memo = text(body.memo, 1000);
  const amount = positiveInteger(body.amount);
  const id = text(body.id || newId('transfer'), 180);
  const idempotencyKey = text(body.idempotencyKey || `${senderWalletId}:${recipientWalletId}:${websiteTokenId}:${amount}:${id}`, 500);

  if (!actorId || !senderWalletId || !recipientWalletId || !amount) {
    return fail(request, env, 400, 'missing_required_transfer_fields');
  }
  if (senderWalletId === recipientWalletId) return fail(request, env, 400, 'sender_and_recipient_must_differ');

  try {
    await env.DB.prepare(`
      INSERT INTO token_transfer_intents (
        id, idempotency_key, actor_id, sender_wallet_id, recipient_wallet_id,
        website_token_id, amount, memo, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(id, idempotencyKey, actorId, senderWalletId, recipientWalletId, websiteTokenId || null, amount, memo, now, now).run();
  } catch (error) {
    const existing = await env.DB.prepare('SELECT id, status, ledger_receipt_id FROM token_transfer_intents WHERE idempotency_key = ?')
      .bind(idempotencyKey).first();
    if (existing) return response(request, env, { ok: true, duplicate: true, ...existing }, 200);
    throw error;
  }

  return response(request, env, {
    ok: true,
    id,
    status: 'pending',
    amount,
    senderWalletId,
    recipientWalletId,
    settlement: 'canonical-ledger-required',
  }, 202);
}

async function recordTransferReceipt(request, env) {
  if (!ledgerReceiptAllowed(request, env)) return fail(request, env, 401, 'ledger_receipt_auth_required');
  const body = await readJson(request);
  const transferIntentId = text(body.transferIntentId, 180);
  const canonicalLedger = text(body.canonicalLedger, 240);
  const canonicalReceiptId = text(body.canonicalReceiptId, 240);
  const senderWalletId = text(body.senderWalletId, 180);
  const recipientWalletId = text(body.recipientWalletId, 180);
  const amount = positiveInteger(body.amount);
  const settledAt = text(body.settledAt || new Date().toISOString(), 80);
  if (!transferIntentId || !canonicalLedger || !canonicalReceiptId || !senderWalletId || !recipientWalletId || !amount) {
    return fail(request, env, 400, 'missing_required_receipt_fields');
  }

  const intent = await env.DB.prepare(`
    SELECT id, sender_wallet_id, recipient_wallet_id, amount, status
    FROM token_transfer_intents WHERE id = ?
  `).bind(transferIntentId).first();
  if (!intent) return fail(request, env, 404, 'transfer_intent_not_found');
  if (intent.sender_wallet_id !== senderWalletId || intent.recipient_wallet_id !== recipientWalletId || Number(intent.amount) !== amount) {
    return fail(request, env, 409, 'receipt_does_not_match_intent');
  }

  const receiptId = newId('receipt');
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO token_transfer_receipts (
        id, transfer_intent_id, canonical_ledger, canonical_receipt_id,
        sender_wallet_id, recipient_wallet_id, amount, settled_at, receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(receiptId, transferIntentId, canonicalLedger, canonicalReceiptId, senderWalletId, recipientWalletId, amount, settledAt, JSON.stringify(body)),
    env.DB.prepare(`
      UPDATE token_transfer_intents
      SET status = 'settled', ledger_receipt_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(canonicalReceiptId, new Date().toISOString(), transferIntentId),
  ]);

  return response(request, env, { ok: true, transferIntentId, status: 'settled', receiptId, canonicalReceiptId }, 201);
}

async function getTransfer(request, env, id) {
  if (!connectorAllowed(request, env)) return fail(request, env, 401, 'connector_auth_required');
  const row = await env.DB.prepare(`
    SELECT id, sender_wallet_id, recipient_wallet_id, website_token_id, amount,
           memo, status, ledger_receipt_id, rejection_reason, created_at, updated_at
    FROM token_transfer_intents WHERE id = ?
  `).bind(id).first();
  if (!row) return fail(request, env, 404, 'transfer_intent_not_found');
  return response(request, env, { ok: true, transfer: row });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        const db = await env.DB.prepare('SELECT 1 AS ok').first();
        return response(request, env, {
          ok: Boolean(db?.ok),
          service: 'c13b0-action-engine',
          capabilities: ['business-sites', 'history-style-runs', 'storefront-connectors', 'transfer-intents', 'ledger-receipts'],
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/business-sites') return saveBusinessSite(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/storefront-connectors') return saveStorefrontConnector(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/transfer-intents') return createTransferIntent(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/transfer-receipts') return recordTransferReceipt(request, env);
      if (request.method === 'GET' && url.pathname.startsWith('/v1/transfer-intents/')) {
        return getTransfer(request, env, decodeURIComponent(url.pathname.split('/').pop() || ''));
      }
      return fail(request, env, 404, 'not_found');
    } catch (error) {
      console.error('action-engine error', error);
      return fail(request, env, 500, 'internal_error');
    }
  },
};
