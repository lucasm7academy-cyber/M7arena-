/**
 * Cliente HTTP do Mercado Pago (ADR-031) — Checkout Transparente, PIX.
 *
 * Porta a edge function `create-mercado-pago-order` do Supabase (site antigo)
 * para a API própria. Segurança: o access token vive só no servidor, e o
 * webhook NÃO confia no payload do MP — confirma o status na API do MP antes
 * de qualquer crédito.
 */

import crypto from "node:crypto";

const MP_API = "https://api.mercadopago.com";

export interface MpPixOrder {
  id: string;
  method: "pix";
  qrCode: string | null;
  brCode: string | null;
}

/** Cria um pagamento PIX no Mercado Pago e devolve o QR code (base64 + copia-e-cola). */
export async function criarPagamentoPix(params: {
  accessToken: string;
  amountBrl: number;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl: string;
  idempotencyKey: string;
}): Promise<MpPixOrder> {
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: params.amountBrl,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`mercadopago_erro_${res.status}`);
    err.status = res.status;
    err.mpBody = body;
    throw err;
  }

  const data = await res.json();
  const td = data.point_of_interaction?.transaction_data;
  return {
    id: String(data.id),
    method: "pix",
    qrCode: td?.qr_code_base64 ?? null,
    brCode: td?.qr_code ?? null,
  };
}

/** Consulta o status real de um pagamento no Mercado Pago (fonte da verdade do webhook). */
export async function consultarStatusPagamento(accessToken: string, paymentId: string): Promise<string> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`mercadopago_consulta_erro_${res.status}`);
    err.status = res.status;
    err.mpBody = body;
    throw err;
  }
  const data = await res.json();
  return String(data.status);
}

/**
 * Valida a assinatura do webhook do Mercado Pago (x-signature).
 * Formato do header: `ts=...,v1=...`. Assinatura HMAC-SHA256 sobre
 * `id:<dataId>;request-id:<requestId>;ts:<ts>;` com o webhook secret.
 * Porta a `parseSignature` da edge function `mercado-pago-webhook` (site antigo).
 */
export function validarAssinatura(params: {
  secret: string;
  signature: string;
  requestId: string;
  dataId: string;
}): boolean {
  const { secret, signature, requestId, dataId } = params;
  const parts: Record<string, string> = {};
  for (const part of signature.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.ts || "";
  const v1 = parts.v1 || "";
  if (!ts || !v1) return false;

  const dataStr = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const calc = crypto.createHmac("sha256", secret).update(dataStr).digest("hex");
  const calcBuf = Buffer.from(calc, "hex");
  const v1Buf = Buffer.from(v1, "hex");
  return calcBuf.length === v1Buf.length && crypto.timingSafeEqual(calcBuf, v1Buf);
}
