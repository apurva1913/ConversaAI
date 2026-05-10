import { useState, useEffect } from 'react';

export default function RPABrowser({ task = "Extracting Invoice Data...", onComplete }) {
  const [step, setStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 150 });
  const [inputValue, setInputValue] = useState('');

  // Sequence of RPA steps
  useEffect(() => {
    const sequence = async () => {
      // Step 1: Move mouse to input field
      await new Promise(r => setTimeout(r, 800));
      setMousePos({ x: 120, y: 100 });
      
      // Step 2: Click input and start typing
      await new Promise(r => setTimeout(r, 600));
      setStep(1); // focus input
      
      const textToType = "INV-99824 - ACME Corp - $450.00";
      for (let i = 0; i <= textToType.length; i++) {
        await new Promise(r => setTimeout(r, 40));
        setInputValue(textToType.substring(0, i));
      }

      // Step 3: Move mouse to submit button
      await new Promise(r => setTimeout(r, 500));
      setMousePos({ x: 120, y: 180 });

      // Step 4: Click submit
      await new Promise(r => setTimeout(r, 400));
      setStep(2); // clicked submit
      
      // Step 5: Loading
      await new Promise(r => setTimeout(r, 800));
      setStep(3); // success
      
      if (onComplete) onComplete();
    };
    
    sequence();
  }, [onComplete]);

  return (
    <div style={{
      width: '100%',
      maxWidth: 400,
      background: '#1e1e1e',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      fontFamily: 'sans-serif',
      position: 'relative',
      marginTop: 12
    }}>
      {/* Browser Chrome */}
      <div style={{
        background: '#2d2d2d',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid #3d3d3d'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <div style={{
          flex: 1,
          background: '#1a1a1a',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 10,
          color: '#888',
          textAlign: 'center'
        }}>
          secure.erp-system.local/sync
        </div>
      </div>

      {/* Browser Viewport */}
      <div style={{ padding: 20, height: 220, position: 'relative', background: '#f5f5f5' }}>
        
        {/* Fake UI */}
        {step < 3 ? (
          <div style={{ opacity: 0.9 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#333' }}>ERP Data Entry</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 4 }}>Extracted Data</label>
              <input 
                type="text" 
                value={inputValue}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px',
                  border: step >= 1 ? '2px solid #3b82f6' : '1px solid #ccc',
                  borderRadius: 4,
                  fontSize: 12,
                  outline: 'none',
                  background: '#fff',
                  color: '#333'
                }}
              />
            </div>

            <button style={{
              background: step === 2 ? '#2563eb' : '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              transform: step === 2 ? 'scale(0.98)' : 'none',
              transition: 'all 0.1s'
            }}>
              {step === 2 ? 'Syncing...' : 'Sync to Database'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#22c55e' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>Sync Successful</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Data securely saved to ERP.</div>
          </div>
        )}

        {/* Fake Mouse Cursor */}
        <div style={{
          position: 'absolute',
          top: mousePos.y,
          left: mousePos.x,
          width: 20,
          height: 20,
          zIndex: 999,
          pointerEvents: 'none',
          transition: 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
          <svg viewBox="0 0 16 16" fill="black" stroke="white" strokeWidth="1.5" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
            <polygon points="1,1 11,15 15,11 15,1" />
          </svg>
        </div>
        
      </div>
      
      {/* RPA Status Footer */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        padding: '8px 12px',
        borderTop: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{task}</span>
        {step < 3 && <span className="spinner" style={{ width: 10, height: 10, marginLeft: 'auto', borderColor: 'rgba(16, 185, 129, 0.3)', borderTopColor: '#10b981' }} />}
      </div>
    </div>
  );
}
