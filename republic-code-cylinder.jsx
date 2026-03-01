import React, { useState, useEffect } from 'react';

// Konvertierung zu Hex-ASCII Format
const toHexAscii = (base64String) => {
  const bytes = atob(base64String).split('').map(c => c.charCodeAt(0));
  const hexLines = [];
  
  // Header
  hexLines.push('╔══════════════════════════════════════════════════════════════════════╗');
  hexLines.push('║  OFFSET    00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F   ASCII   ║');
  hexLines.push('╠══════════════════════════════════════════════════════════════════════╣');
  
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hex = chunk.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    const ascii = chunk.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
    const offset = i.toString(16).padStart(8, '0').toUpperCase();
    hexLines.push(`║  ${offset}  ${hex.padEnd(47)}  ${ascii.padEnd(16)} ║`);
  }
  
  hexLines.push('╚══════════════════════════════════════════════════════════════════════╝');
  
  return hexLines.join('\n');
};

// Konvertierung von Hex-ASCII zurück zu Base64
const fromHexAscii = (hexAsciiString) => {
  const lines = hexAsciiString.trim().split('\n');
  const bytes = [];
  
  for (const line of lines) {
    // Überspringe Header, Footer und Trennlinien
    if (line.includes('═') || line.includes('OFFSET') || line.trim() === '' || !line.startsWith('║')) continue;
    
    // Format: ║  XXXXXXXX  HH HH HH ... (47 chars)  ASCII (16 chars) ║
    // Hex-Teil beginnt bei Position 13 und ist 47 Zeichen lang
    if (line.length >= 60) {
      const hexPart = line.substring(13, 60).trim();
      const hexBytes = hexPart.split(/\s+/).filter(h => /^[0-9A-Fa-f]{2}$/.test(h));
      
      for (const hex of hexBytes) {
        bytes.push(parseInt(hex, 16));
      }
    }
  }
  
  if (bytes.length === 0) {
    throw new Error('Keine gültigen Hex-Daten gefunden');
  }
  
  return btoa(String.fromCharCode(...bytes));
};

// AES-256 Encryption using Web Crypto API
const CryptoUtils = {
  async generateKey(password, iterations = 100000) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('REPUBLIC_GRAND_ARMY_SALT_V2'),
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(text, password, iterations = 100000) {
    const key = await this.generateKey(password, iterations);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(text)
    );
    
    // Encode iterations in first 4 bytes (big-endian, unsigned)
    const iterBytes = new Uint8Array([
      (iterations >>> 24) & 0xff,
      (iterations >>> 16) & 0xff,
      (iterations >>> 8) & 0xff,
      iterations & 0xff
    ]);
    
    const combined = new Uint8Array(4 + iv.length + encrypted.byteLength);
    combined.set(iterBytes);
    combined.set(iv, 4);
    combined.set(new Uint8Array(encrypted), 4 + iv.length);
    
    return btoa(String.fromCharCode(...combined));
  },

  async decrypt(encryptedText, password) {
    try {
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(c => c.charCodeAt(0))
      );
      
      // Extract iterations from first 4 bytes (big-endian, unsigned)
      const iterations = ((combined[0] << 24) >>> 0) + (combined[1] << 16) + (combined[2] << 8) + combined[3];
      const iv = combined.slice(4, 16);
      const data = combined.slice(16);
      
      const key = await this.generateKey(password, iterations);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      throw new Error('ENTSCHLÜSSELUNG FEHLGESCHLAGEN - UNGÜLTIGER ZUGANGSCODE');
    }
  }
};

// Aurebesh-inspired character mapping for display
const toAurebesh = (text) => {
  const map = {
    'A': '𐤀', 'B': '𐤁', 'C': '𐤂', 'D': '𐤃', 'E': '𐤄',
    'F': '𐤅', 'G': '𐤆', 'H': '𐤇', 'I': '𐤈', 'J': '𐤉',
    'K': '𐤊', 'L': '𐤋', 'M': '𐤌', 'N': '𐤍', 'O': '𐤎',
    'P': '𐤏', 'Q': '𐤐', 'R': '𐤑', 'S': '𐤒', 'T': '𐤓',
    'U': '𐤔', 'V': '𐤕', 'W': '𐤖', 'X': '𐤗', 'Y': '𐤘', 'Z': '𐤙'
  };
  return text.toUpperCase().split('').map(c => map[c] || c).join('');
};

// Glowing ring component
const GlowRing = ({ index, total, active }) => {
  const angle = (index / total) * 360;
  const delay = index * 0.1;
  
  return (
    <div 
      className="absolute w-full h-1 rounded-full transition-all duration-500"
      style={{
        top: `${10 + (index * (80 / total))}%`,
        background: active 
          ? `linear-gradient(90deg, transparent, #00d4ff, #0099cc, #00d4ff, transparent)`
          : `linear-gradient(90deg, transparent, #334455, #445566, #334455, transparent)`,
        boxShadow: active ? '0 0 10px #00d4ff, 0 0 20px #0099cc' : 'none',
        animation: active ? `pulse 2s ease-in-out ${delay}s infinite` : 'none'
      }}
    />
  );
};

// Data stream effect
const DataStream = ({ active }) => {
  const chars = '01アイウエオカキクケコサシスセソタチツテト';
  const [streams, setStreams] = useState([]);
  
  useEffect(() => {
    if (!active) {
      setStreams([]);
      return;
    }
    
    const interval = setInterval(() => {
      setStreams(prev => {
        const newStreams = prev.filter(s => s.life > 0).map(s => ({
          ...s,
          y: s.y + 2,
          life: s.life - 1
        }));
        
        if (Math.random() > 0.7) {
          newStreams.push({
            id: Date.now() + Math.random(),
            x: Math.random() * 100,
            y: 0,
            char: chars[Math.floor(Math.random() * chars.length)],
            life: 50
          });
        }
        
        return newStreams.slice(-20);
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [active]);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
      {streams.map(s => (
        <span
          key={s.id}
          className="absolute text-cyan-400 text-xs font-mono"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            opacity: s.life / 50
          }}
        >
          {s.char}
        </span>
      ))}
    </div>
  );
};

// Main Component
export default function RepublicCodeCylinder() {
  const [mode, setMode] = useState('encrypt');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('BEREIT');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [cylinderRotation, setCylinderRotation] = useState(0);
  const [securityLevel, setSecurityLevel] = useState('AUREK');
  
  // Kanonische Sicherheitsstufen der Galaktischen Republik (Aurebesh)
  const securityLevels = {
    'AUREK': { color: '#00ff00', level: 1, desc: 'Basis', iterations: 50000 },
    'BESH': { color: '#ffff00', level: 2, desc: 'Standard', iterations: 75000 },
    'BESH NAVBR': { color: '#8B4513', level: 3, desc: 'Navigation', iterations: 100000 },
    'CRESH': { color: '#ff8800', level: 4, desc: 'Vertraulich', iterations: 150000 },
    'DORN': { color: '#ff0000', level: 5, desc: 'Geheim', iterations: 200000 },
    'ESK': { color: '#9900ff', level: 6, desc: 'Streng Geheim', iterations: 300000 },
    'LETH': { color: '#ffffff', level: 7, desc: 'Black Ops / Geheimdienst', iterations: 500000, bgColor: '#000000' }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCylinderRotation(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const processData = async () => {
    if (!inputText || !accessCode) {
      setStatus('FEHLER: DATEN ODER ZUGANGSCODE FEHLT');
      return;
    }
    
    if (accessCode.length < 8) {
      setStatus('FEHLER: ZUGANGSCODE MUSS MIN. 8 ZEICHEN HABEN');
      return;
    }

    setIsProcessing(true);
    setStatus(mode === 'encrypt' ? 'VERSCHLÜSSELE...' : 'ENTSCHLÜSSELE...');
    
    // Simulate processing time for effect
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      if (mode === 'encrypt') {
        const iterations = securityLevels[securityLevel].iterations;
        const encryptedBase64 = await CryptoUtils.encrypt(inputText, accessCode, iterations);
        const hexOutput = toHexAscii(encryptedBase64);
        setOutputText(hexOutput);
        setStatus(`VERSCHLÜSSELUNG ABGESCHLOSSEN • ${securityLevel}`);
      } else {
        try {
          // Konvertiere Hex-ASCII zurück zu Base64 für Entschlüsselung
          const base64Input = fromHexAscii(inputText);
          const decrypted = await CryptoUtils.decrypt(base64Input, accessCode);
          setOutputText(decrypted);
          setStatus('ENTSCHLÜSSELUNG ABGESCHLOSSEN');
        } catch (parseError) {
          throw new Error('UNGÜLTIGES HEX-FORMAT ODER FALSCHER ZUGANGSCODE');
        }
      }
    } catch (e) {
      setStatus(e.message || 'VERARBEITUNG FEHLGESCHLAGEN');
      setOutputText('');
    }
    
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-slate-800 to-gray-900 p-4 flex items-center justify-center">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scaleX(0.95); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scanline {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .cylinder-body {
          background: linear-gradient(90deg, 
            #1a1a2e 0%, 
            #2d2d44 15%, 
            #4a4a6a 30%, 
            #6a6a8a 50%, 
            #4a4a6a 70%, 
            #2d2d44 85%, 
            #1a1a2e 100%
          );
        }
        .republic-emblem {
          background: radial-gradient(circle, #00d4ff22 0%, transparent 70%);
        }
        .holographic {
          background: linear-gradient(135deg, 
            rgba(0,212,255,0.1) 0%, 
            rgba(0,153,204,0.2) 50%, 
            rgba(0,212,255,0.1) 100%
          );
        }
      `}</style>
      
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-cyan-400 tracking-widest">
              GALAKTISCHE REPUBLIK
            </h1>
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-cyan-400" />
            </div>
          </div>
          <p className="text-cyan-600 text-sm tracking-wider">
            CODE-ZYLINDER • MILITÄRISCHE VERSCHLÜSSELUNG
          </p>
        </div>

        {/* Main Cylinder Container */}
        <div className="relative">
          {/* Cylinder Visual */}
          <div className="relative mx-auto w-64 h-80 mb-6">
            {/* Top cap */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 rounded-full border-2 border-cyan-700"
              style={{
                background: 'linear-gradient(180deg, #4a5568 0%, #2d3748 50%, #1a202c 100%)',
                boxShadow: '0 0 20px rgba(0,212,255,0.3), inset 0 2px 4px rgba(255,255,255,0.2)'
              }}
            >
              <div className="absolute inset-2 rounded-full bg-cyan-900/50 flex items-center justify-center">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{
                    background: securityLevels[securityLevel].bgColor || securityLevels[securityLevel].color,
                    boxShadow: securityLevel === 'LETH' 
                      ? '0 0 15px #ffffff, 0 0 25px #888888, inset 0 0 5px #333333' 
                      : `0 0 15px ${securityLevels[securityLevel].color}`,
                    border: securityLevel === 'LETH' ? '2px solid #444444' : 'none'
                  }}
                />
              </div>
            </div>
            
            {/* Main body */}
            <div 
              className="absolute top-6 left-1/2 -translate-x-1/2 w-44 h-64 cylinder-body rounded-lg border border-cyan-800 overflow-hidden"
              style={{
                boxShadow: '0 0 30px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,0,0,0.5)'
              }}
            >
              {/* Glow rings */}
              {[...Array(8)].map((_, i) => (
                <GlowRing key={i} index={i} total={8} active={isProcessing} />
              ))}
              
              {/* Data stream effect */}
              <DataStream active={isProcessing} />
              
              {/* Center emblem */}
              <div className="absolute inset-0 flex items-center justify-center republic-emblem">
                <div 
                  className="w-20 h-20 rounded-full border-2 border-cyan-500/50 flex items-center justify-center"
                  style={{
                    transform: `rotate(${cylinderRotation}deg)`,
                    background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)'
                  }}
                >
                  <svg viewBox="0 0 100 100" className="w-16 h-16 text-cyan-400">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
                    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                    <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="currentColor" opacity="0.6"/>
                    <circle cx="50" cy="50" r="8" fill="currentColor"/>
                  </svg>
                </div>
              </div>
              
              {/* Scan line */}
              {isProcessing && (
                <div 
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                  style={{
                    animation: 'scanline 1s linear infinite',
                    boxShadow: '0 0 10px #00d4ff'
                  }}
                />
              )}
              
              {/* Side details */}
              <div className="absolute left-1 top-1/4 w-1 h-1/2 bg-gradient-to-b from-cyan-600 via-cyan-400 to-cyan-600 rounded-full opacity-50"/>
              <div className="absolute right-1 top-1/4 w-1 h-1/2 bg-gradient-to-b from-cyan-600 via-cyan-400 to-cyan-600 rounded-full opacity-50"/>
            </div>
            
            {/* Bottom cap */}
            <div 
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-8 rounded-full border-2 border-cyan-800"
              style={{
                background: 'linear-gradient(0deg, #4a5568 0%, #2d3748 50%, #1a202c 100%)',
                boxShadow: '0 5px 20px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          {/* Control Panel */}
          <div className="holographic rounded-xl border border-cyan-700/50 p-6 backdrop-blur-sm">
            {/* Status Display */}
            <div className="bg-black/50 rounded-lg p-3 mb-4 border border-cyan-900">
              <div className="flex items-center justify-between">
                <span className="text-cyan-600 text-xs tracking-wider">STATUS:</span>
                <span className={`text-sm font-mono tracking-wider ${
                  status.includes('FEHLER') ? 'text-red-400' : 
                  status.includes('ABGESCHLOSSEN') ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {status}
                </span>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setMode('encrypt');
                  setOutputText('');
                  setStatus('BEREIT ZUM VERSCHLÜSSELN');
                }}
                className={`flex-1 py-3 rounded-lg font-bold tracking-wider transition-all ${
                  mode === 'encrypt'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/50'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                VERSCHLÜSSELN
              </button>
              <button
                onClick={() => {
                  setMode('decrypt');
                  setOutputText('');
                  setStatus('BEREIT ZUM ENTSCHLÜSSELN');
                }}
                className={`flex-1 py-3 rounded-lg font-bold tracking-wider transition-all ${
                  mode === 'decrypt'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/50'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                ENTSCHLÜSSELN
              </button>
            </div>

            {/* Security Level */}
            <div className="mb-4">
              <label className="text-cyan-600 text-xs tracking-wider block mb-2">
                SICHERHEITSSTUFE:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(securityLevels).map(([level, data]) => (
                  <button
                    key={level}
                    onClick={() => setSecurityLevel(level)}
                    className={`py-2 px-2 rounded text-xs font-bold transition-all flex flex-col items-center ${
                      securityLevel === level
                        ? 'ring-2 ring-offset-2 ring-offset-gray-900'
                        : 'opacity-50 hover:opacity-75'
                    }`}
                    style={{
                      backgroundColor: data.bgColor || (data.color + '33'),
                      color: data.color,
                      ringColor: data.color
                    }}
                  >
                    <span>{level}</span>
                    <span className="text-[10px] opacity-70">{data.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Access Code Input */}
            <div className="mb-4">
              <label className="text-cyan-600 text-xs tracking-wider block mb-2">
                ZUGANGSCODE (MIN. 8 ZEICHEN):
              </label>
              <div className="relative">
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Geheimen Zugangscode eingeben..."
                  className="w-full bg-black/50 border border-cyan-800 rounded-lg px-4 py-3 text-cyan-300 placeholder-cyan-800 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-600 hover:text-cyan-400"
                >
                  {showAccessCode ? '◉' : '◎'}
                </button>
              </div>
            </div>

            {/* Input Text */}
            <div className="mb-4">
              <label className="text-cyan-600 text-xs tracking-wider block mb-2">
                {mode === 'encrypt' ? 'KLARTEXT EINGABE:' : 'VERSCHLÜSSELTER HEX-CODE:'}
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={mode === 'encrypt' ? 'Geheime Nachricht eingeben...' : 'Hex-ASCII Code hier einfügen...'}
                className={`w-full bg-black/50 border border-cyan-800 rounded-lg px-4 py-3 text-cyan-300 placeholder-cyan-800 focus:outline-none focus:border-cyan-500 font-mono resize-none ${mode === 'decrypt' ? 'text-[10px] h-64 whitespace-pre overflow-x-auto leading-tight' : 'text-sm h-24'}`}
                style={mode === 'decrypt' ? { fontFamily: 'Consolas, Monaco, "Courier New", monospace' } : {}}
              />
            </div>

            {/* Process Button */}
            <button
              onClick={processData}
              disabled={isProcessing}
              className={`w-full py-4 rounded-lg font-bold tracking-widest transition-all ${
                isProcessing
                  ? 'bg-cyan-900 text-cyan-600 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/30'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">◌</span>
                  VERARBEITE...
                </span>
              ) : (
                mode === 'encrypt' ? '◈ VERSCHLÜSSELN ◈' : '◈ ENTSCHLÜSSELN ◈'
              )}
            </button>

            {/* Output */}
            {outputText && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-cyan-600 text-xs tracking-wider">
                    {mode === 'encrypt' ? 'VERSCHLÜSSELTE AUSGABE [HEX-ASCII]:' : 'ENTSCHLÜSSELTER KLARTEXT:'}
                  </label>
                  <div className="flex gap-2">
                    <span className="text-xs text-cyan-700">
                      Klicken → Strg+C
                    </span>
                    {mode === 'encrypt' && (
                      <button
                        onClick={() => {
                          setInputText(outputText);
                          setMode('decrypt');
                          setOutputText('');
                          setStatus('HEX-CODE ÜBERTRAGEN - BEREIT ZUM ENTSCHLÜSSELN');
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 border border-cyan-700 rounded hover:bg-cyan-900/30"
                      >
                        → ENTSCHLÜSSELN
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  readOnly
                  value={outputText}
                  onClick={(e) => {
                    e.target.select();
                    setStatus('TEXT AUSGEWÄHLT - STRG+C ZUM KOPIEREN');
                  }}
                  onCopy={() => setStatus('ERFOLGREICH KOPIERT')}
                  className={`w-full bg-black/90 border border-cyan-700 rounded-lg p-4 font-mono text-green-400 resize-none focus:outline-none focus:border-cyan-500 cursor-pointer ${mode === 'encrypt' ? 'text-[10px] h-64 whitespace-pre overflow-x-auto leading-tight' : 'text-sm h-32'}`}
                  style={mode === 'encrypt' ? { fontFamily: 'Consolas, Monaco, "Courier New", monospace' } : {}}
                />
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-cyan-900/50 text-center">
              <p className="text-cyan-800 text-xs tracking-wider">
                AES-256-GCM • PBKDF2-SHA256 • HEX-ASCII • {securityLevels[securityLevel].iterations.toLocaleString()} ITERATIONEN
              </p>
              <p className="text-cyan-900 text-xs mt-1">
                GROSSE ARMEE DER REPUBLIK • VERSCHLUSSSACHE STUFE {securityLevel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
