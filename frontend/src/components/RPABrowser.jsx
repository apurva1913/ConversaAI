import { useState, useEffect, useMemo } from 'react';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const STEPS = [
  { id: 'nav',     label: 'Navigate', icon: '🌐', detail: 'Opening target portal…' },
  { id: 'locate',  label: 'Locate',   icon: '🔍', detail: 'Scanning for input elements…' },
  { id: 'input',   label: 'Input',    icon: '⌨️', detail: 'Entering search query…' },
  { id: 'submit',  label: 'Submit',   icon: '🖱️', detail: 'Submitting request…' },
  { id: 'process', label: 'Process',  icon: '⚙️', detail: 'Waiting for response…' },
  { id: 'extract', label: 'Extract',  icon: '📊', detail: 'Extracting structured data…' },
  { id: 'done',    label: 'Done',     icon: '✅', detail: 'Automation complete!' },
];

export default function RPABrowser({
  task = "Browser Automation",
  query = "",
  onComplete
}) {
  const [step, setStep]             = useState(-1);
  const [typedUrl, setTypedUrl]     = useState('');
  const [typedQuery, setTypedQuery] = useState('');
  const [mousePos, setMousePos]     = useState({ x: 50, y: 50 });
  const [inputFocused, setInputFocused] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [results, setResults]       = useState([]);
  const [hlRow, setHlRow]           = useState(-1);

  const searchText = query || 'invoice ACME-2024-0098 extract data';
  const fullUrl    = 'https://secure.erp-portal.com/data/search';

  const mockResults = useMemo(() => [
    { field: 'Invoice #', value: 'INV-2024-0098' },
    { field: 'Vendor',    value: 'ACME Corporation' },
    { field: 'Amount',    value: '$2,450.00' },
    { field: 'Status',    value: 'Processed ✓' },
  ], []);

  useEffect(() => {
    let dead = false;
    const run = async () => {
      /* 0 — Navigate */
      setStep(0);
      setMousePos({ x: 180, y: 28 });
      await delay(350);
      for (let i = 0; i <= fullUrl.length; i++) {
        if (dead) return;
        await delay(12);
        setTypedUrl(fullUrl.slice(0, i));
      }
      await delay(300);

      /* 1 — Locate */
      setStep(1);
      setMousePos({ x: 150, y: 125 });
      await delay(500);
      setInputFocused(true);
      await delay(200);

      /* 2 — Type */
      setStep(2);
      for (let i = 0; i <= searchText.length; i++) {
        if (dead) return;
        await delay(28 + Math.random() * 22);
        setTypedQuery(searchText.slice(0, i));
      }
      await delay(300);

      /* 3 — Submit */
      setStep(3);
      setMousePos({ x: 260, y: 172 });
      await delay(400);
      setBtnPressed(true);
      await delay(150);
      setBtnPressed(false);

      /* 4 — Process */
      setStep(4);
      setShowLoader(true);
      await delay(900);
      setShowLoader(false);

      /* 5 — Extract */
      setStep(5);
      for (let i = 0; i < mockResults.length; i++) {
        if (dead) return;
        await delay(220);
        setResults(prev => [...prev, mockResults[i]]);
        setHlRow(i);
        await delay(120);
        setHlRow(-1);
      }
      await delay(350);

      /* 6 — Done */
      setStep(6);
      onComplete?.();
    };

    const t = setTimeout(run, 150);
    return () => { dead = true; clearTimeout(t); };
  }, []);                           // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.max(0, ((step + 1) / STEPS.length) * 100);

  /* ── Render ──────────────────────────────────────── */
  return (
    <div className="rpab">
      {/* ── Chrome ── */}
      <div className="rpab-chrome">
        <div className="rpab-dots">
          <i style={{ background: '#ff5f56' }} />
          <i style={{ background: '#ffbd2e' }} />
          <i style={{ background: '#27c93f' }} />
        </div>
        <div className="rpab-nav">
          <span>‹</span><span>›</span><span>↻</span>
        </div>
        <div className="rpab-addr">
          <span className="rpab-lock">🔒</span>
          <span className="rpab-url">{typedUrl || 'about:blank'}</span>
          {step >= 0 && step < 6 && <span className="rpab-caret">|</span>}
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="rpab-prog-track">
        <div className="rpab-prog-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* ── Viewport ── */}
      <div className="rpab-viewport">
        {step < 4 ? (
          /* Form view */
          <div className="rpab-form">
            <div className="rpab-form-title">Enterprise Data Portal</div>
            <div className="rpab-form-sub">Intelligent Search & Extract</div>

            <label className="rpab-label">Search Query</label>
            <div className={`rpab-input${inputFocused ? ' focused' : ''}`}>
              {typedQuery}
              {step >= 1 && step < 4 && <span className="rpab-blink">|</span>}
            </div>

            <button className={`rpab-btn${btnPressed ? ' pressed' : ''}`}>
              {step === 3 ? '⏳ Searching…' : '🔍 Search & Extract'}
            </button>
          </div>
        ) : step < 6 ? (
          /* Results view */
          <div className="rpab-results">
            {showLoader ? (
              <div className="rpab-loader">
                <span className="spinner" style={{ width: 22, height: 22 }} />
                <span>Querying database…</span>
              </div>
            ) : (
              <>
                <div className="rpab-results-hdr">
                  📊 Found <strong>{results.length}</strong> fields
                </div>
                {results.map((r, i) => (
                  <div key={i} className={`rpab-row${hlRow === i ? ' hl' : ''}`}
                    style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="rpab-row-check">✓</span>
                    <span className="rpab-row-field">{r.field}</span>
                    <span className="rpab-row-val">{r.value}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Success view */
          <div className="rpab-done">
            <div className="rpab-done-icon">✅</div>
            <div className="rpab-done-title">Automation Complete</div>
            <div className="rpab-done-sub">{mockResults.length} fields extracted successfully</div>
          </div>
        )}

        {/* Cursor */}
        <div className="rpab-cursor" style={{ top: mousePos.y, left: mousePos.x }}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 3l14 9-7 1-4 7z" fill="#fff" stroke="#000" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>

      {/* ── Steps bar ── */}
      <div className="rpab-steps">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`rpab-step${i < step ? ' done' : i === step ? ' active' : ''}`}>
            <span className="rpab-step-icon">{s.icon}</span>
            <span className="rpab-step-lbl">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="rpab-footer">
        <span>🤖</span>
        <span className="rpab-footer-txt">{STEPS[Math.max(0, Math.min(step, 6))]?.detail}</span>
        {step < 6 && <span className="spinner" style={{ width: 10, height: 10, marginLeft: 'auto' }} />}
      </div>
    </div>
  );
}
