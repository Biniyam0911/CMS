import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Printer, ExternalLink, ArrowLeft } from 'lucide-react';

interface VerifyData {
  success: boolean;
  paid: boolean;
  txRef?: string;
  status?: string;
  amount?: number;
  currency?: string;
  chapaReference?: string;
  message?: string;
}

export default function ChapaPaymentReturnPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const txRef = searchParams.get('tx_ref') || searchParams.get('trx_ref') || '';
  const invoiceId = searchParams.get('invoice_id') || '';

  const verifyPayment = async () => {
    if (!txRef) {
      setLoading(false);
      setError('No transaction reference found in return URL.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/chapa/verify/${encodeURIComponent(txRef)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();
      const payload: VerifyData = json?.data || json?.Data || json;
      setData(payload);

      if (!res.ok || (!payload?.paid && payload?.status !== 'success')) {
        setError(payload?.message || `Payment status is ${payload?.status || 'unconfirmed'}.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to verify transaction with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #091206 0%, #0d1e0d 50%, #06110a 100%)',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: 'rgba(18, 32, 14, 0.95)',
        border: '1px solid rgba(125, 194, 66, 0.35)',
        borderRadius: '24px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(125, 194, 66, 0.12)',
        textAlign: 'center'
      }}>
        {/* Brand */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(125, 194, 66, 0.12)',
          border: '1px solid rgba(125, 194, 66, 0.3)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#7DC242',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '24px'
        }}>
          Chapa Secure Payment
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <Loader2 size={54} color="#7DC242" className="animate-spin" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>Verifying Payment…</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Confirming transaction with Chapa payment gateway. Please wait.
            </p>
          </div>
        ) : data?.paid || data?.status === 'success' ? (
          <div>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(125, 194, 66, 0.15)',
              border: '2px solid #7DC242',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#7DC242'
            }}>
              <CheckCircle2 size={48} />
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
              Payment Successful!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Your payment has been verified and settled in the clinic management system.
            </p>

            {/* Receipt Summary Card */}
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '26px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Amount Paid</span>
                <span style={{ fontWeight: 800, color: '#7DC242', fontSize: '1.15rem', fontFamily: 'monospace' }}>
                  {data.currency || 'ETB'} {Number(data.amount || 0).toFixed(2)}
                </span>
              </div>

              {invoiceId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Invoice ID</span>
                  <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>#{invoiceId}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Payment Gateway</span>
                <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>Chapa (Ethiopia)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Reference</span>
                <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', maxWidth: '240px', wordBreak: 'break-all', textAlign: 'right' }}>
                  {txRef}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7DC242, #5a9e2f)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(125,194,66,0.3)'
                }}
              >
                <Printer size={16} /> Print Receipt
              </button>

              <button
                onClick={() => {
                  if (window.opener) {
                    window.close();
                  } else {
                    window.location.href = '/';
                  }
                }}
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.8)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={15} /> Return to Application
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#ef4444'
            }}>
              <XCircle size={48} />
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
              Payment Unconfirmed
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', marginBottom: '20px' }}>
              {error || 'We could not confirm completion of this transaction.'}
            </p>

            {txRef && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '22px',
                wordBreak: 'break-all'
              }}>
                Ref: {txRef}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={verifyPayment}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7DC242, #5a9e2f)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Re-check Payment Status
              </button>

              <button
                onClick={() => { window.location.href = '/'; }}
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.8)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Back to Login / Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
