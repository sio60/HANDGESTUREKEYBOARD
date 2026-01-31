import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import VirtualKeyboard from './components/VirtualKeyboard';
import HandCanvas from './components/HandCanvas';
import { HangulAutomaton } from './utils/HangulAutomaton';

const DWELL_TIME = 800; // 0.8 seconds for click
const AUTO_CALIB_TIME = 2000; // 2 seconds for auto-calibration

function App() {
  const [trackingData, setTrackingData] = useState(null);
  const [composedText, setComposedText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isKorean, setIsKorean] = useState(true);
  const [currentHoverKeys, setCurrentHoverKeys] = useState({
    Left: { thumb: null, index: null, middle: null, ring: null, pinky: null },
    Right: { thumb: null, index: null, middle: null, ring: null, pinky: null }
  });
  const [dwellProgresses, setDwellProgresses] = useState({
    Left: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
    Right: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const automatonRef = useRef(new HangulAutomaton());
  const wsRef = useRef(null);
  const hoverStartTimeRef = useRef({
    Left: { thumb: null, index: null, middle: null, ring: null, pinky: null },
    Right: { thumb: null, index: null, middle: null, ring: null, pinky: null }
  });
  const autoCalibStartTimeRef = useRef({
    Left: { thumb: null, index: null, middle: null, ring: null, pinky: null },
    Right: { thumb: null, index: null, middle: null, ring: null, pinky: null }
  });

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/hand-tracking');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws.send(JSON.stringify({ type: 'config', send_video: true }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'tracking') {
            setTrackingData(data);

            // 데이터가 오기 시작하면(카메라 스트리밍 시작) 로딩 화면 해제
            setIsLoading(false);

            if (data.hands && data.hands.length > 0) {
              data.hands.forEach(hand => {
                const { label, fingers, fist } = hand;

                // Handle Hand-level state (Fist)
                if (fist?.fist_triggered) {
                  handleFist();
                }

                // Handle Finger-level states
                Object.entries(fingers).forEach(([f_name, f_data]) => {
                  if (f_data.pinch?.pinch_triggered) {
                    handleHit(f_data.pointer);
                  }
                  updateFingerState(label, f_name, f_data);
                });
              });

              // 손이 감지되지 않은 경우의 상태 정리
              const detectedLabels = data.hands.map(h => h.label);
              ['Left', 'Right'].forEach(label => {
                if (!detectedLabels.includes(label)) {
                  resetHandState(label);
                }
              });

              // Anchor Calibration Check (F & J)
              checkAnchorCalibration();
            } else {
              resetHandState('Left');
              resetHandState('Right');
            }
          }
        } catch (e) {
          console.error("WS Message Error:", e);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        // 연결이 완전히 끊겼을 때만 다시 로딩 표시 (선택 사항)
        // setIsLoading(true); 
        setTimeout(connect, 3000);
      };

      ws.onerror = () => setConnectionStatus('error');
    };

    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // 의존성 배열에서 isLoading 제거 (무한 재연결 방지)

  const handleKeyPress = useCallback((key) => {
    if (key === 'SPACE') {
      automatonRef.current.add(' ');
    } else if (key === '←') {
      automatonRef.current.backspace();
    } else if (key === '한/영') {
      automatonRef.current.flush();
      setIsKorean(prev => !prev);
    } else if (key === '⏎') {
      automatonRef.current.flush();
      automatonRef.current.add('\n');
    } else {
      automatonRef.current.add(key);
    }
    setComposedText(automatonRef.current.getComposedText());
    playClickSound();
  }, []);

  const handleFist = () => {
    automatonRef.current.clear();
    setComposedText('');
    playDeleteSound();
  };

  const handleHit = (pointer) => {
    if (!pointer) return;
    const [nx, ny] = pointer;
    const x = nx * window.innerWidth;
    const y = ny * window.innerHeight;
    const element = document.elementFromPoint(x, y);

    if (element && element.classList.contains('keyboard-key')) {
      const key = element.getAttribute('data-key') || (element.innerText === '␣ Space' ? 'SPACE' : element.innerText);
      handleKeyPress(key);
    }
  };

  const resetHandState = (label) => {
    setCurrentHoverKeys(prev => ({
      ...prev,
      [label]: { thumb: null, index: null, middle: null, ring: null, pinky: null }
    }));
    setDwellProgresses(prev => ({
      ...prev,
      [label]: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 }
    }));
    Object.keys(hoverStartTimeRef.current[label]).forEach(f_name => {
      hoverStartTimeRef.current[label][f_name] = null;
      autoCalibStartTimeRef.current[label][f_name] = null;
    });
  };

  const updateFingerState = (label, fingerName, fingerData) => {
    const { pointer } = fingerData;
    if (!pointer) {
      resetFingerState(label, fingerName);
      return;
    }

    const [nx, ny] = pointer;
    const x = nx * window.innerWidth;
    const y = ny * window.innerHeight;
    const element = document.elementFromPoint(x, y);

    if (element && element.classList.contains('keyboard-key')) {
      const key = element.getAttribute('data-key') || (element.innerText === '␣ Space' ? 'SPACE' : element.innerText);

      if (currentHoverKeys[label][fingerName] === key) {
        const now = Date.now();
        const startTime = hoverStartTimeRef.current[label][fingerName] || now;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DWELL_TIME, 1);

        setDwellProgresses(prev => ({
          ...prev,
          [label]: { ...prev[label], [fingerName]: progress }
        }));

        if (progress >= 1) {
          handleKeyPress(key);
          hoverStartTimeRef.current[label][fingerName] = now;
        }
      } else {
        setCurrentHoverKeys(prev => ({
          ...prev,
          [label]: { ...prev[label], [fingerName]: key }
        }));
        const now = Date.now();
        hoverStartTimeRef.current[label][fingerName] = now;
        autoCalibStartTimeRef.current[label][fingerName] = now;
        setDwellProgresses(prev => ({
          ...prev,
          [label]: { ...prev[label], [fingerName]: 0 }
        }));
      }
    } else {
      resetFingerState(label, fingerName);
    }
  };

  const resetFingerState = (label, fingerName) => {
    setCurrentHoverKeys(prev => ({
      ...prev,
      [label]: { ...prev[label], [fingerName]: null }
    }));
    setDwellProgresses(prev => ({
      ...prev,
      [label]: { ...prev[label], [fingerName]: 0 }
    }));
    hoverStartTimeRef.current[label][fingerName] = null;
    autoCalibStartTimeRef.current[label][fingerName] = null;
  };

  const checkAnchorCalibration = () => {
    // Left Index on 'F' AND Right Index on 'J'
    const leftIndexKey = currentHoverKeys.Left.index;
    const rightIndexKey = currentHoverKeys.Right.index;

    if (leftIndexKey === 'F' && rightIndexKey === 'J') {
      const now = Date.now();
      const lCalibStart = autoCalibStartTimeRef.current.Left.index;
      const rCalibStart = autoCalibStartTimeRef.current.Right.index;

      if (lCalibStart && rCalibStart) {
        const elapsed = now - Math.max(lCalibStart, rCalibStart);
        if (elapsed >= AUTO_CALIB_TIME) {
          triggerAnchorCalibration();
          autoCalibStartTimeRef.current.Left.index = now;
          autoCalibStartTimeRef.current.Right.index = now;
        }
      }
    }
  };

  const triggerAnchorCalibration = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("⚓ Anchor Calibration Triggered!");
      // F와 J 동시 캘리브레이션 요청 (백엔드에서 처리하거나 프론트에서 오프셋 계산)
      // 여기서는 백엔드에 F와 J 위치 정보를 함께 보낼 수도 있으나, 
      // 현재 백엔드 calibrate 함수는 단일 요청을 처리하므로 순차적으로 혹은 확장하여 보냄

      // F 키 위치 (정적 혹은 엘리먼트 기준)
      const f_el = document.getElementById('key-F');
      const j_el = document.getElementById('key-J');

      if (f_el && j_el) {
        const f_rect = f_el.getBoundingClientRect();
        const j_rect = j_el.getBoundingClientRect();

        const f_center = [(f_rect.left + f_rect.width / 2) / window.innerWidth, (f_rect.top + f_rect.height / 2) / window.innerHeight];
        const j_center = [(j_rect.left + j_rect.width / 2) / window.innerWidth, (j_rect.top + j_rect.height / 2) / window.innerHeight];

        // 백엔드에 F 캘리브레이션 요청
        wsRef.current.send(JSON.stringify({
          type: 'calibrate',
          target: f_center,
          finger: 8 // Left Index tip index usually handled internally but can specify
        }));

        playCalibSound();
        setIsCalibrating(true);
        setTimeout(() => setIsCalibrating(false), 1000);
      }
    }
  };

  const playClickSound = (freq = 800) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; g.gain.value = 0.1;
      o.start(); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      o.stop(ctx.currentTime + 0.1);
    } catch (e) { }
  };

  const playDeleteSound = () => playClickSound(400);
  const playCalibSound = () => {
    playClickSound(1200);
    setTimeout(() => playClickSound(1500), 50);
  };

  const requestCalibration = (key) => {
    const el = document.getElementById(`key-${key}`);
    if (el && wsRef.current) {
      const rect = el.getBoundingClientRect();
      const targetX = (rect.left + rect.width / 2) / window.innerWidth;
      const targetY = (rect.top + rect.height / 2) / window.innerHeight;
      wsRef.current.send(JSON.stringify({
        type: 'calibrate',
        target: [targetX, targetY],
        finger: 8
      }));
      setIsCalibrating(true);
      playCalibSound();
      setTimeout(() => setIsCalibrating(false), 1000);
    }
  };

  const resetCalibration = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'reset_calibration' }));
      playDeleteSound();
    }
  };

  return (
    <div className="app-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <h2>손을 카메라에 보여주세요</h2>
          <p>{connectionStatus === 'connected' ? '모델 준비 중...' : '서버 연결 중...'}</p>
        </div>
      )}

      <header className="app-header">
        <div className="logo-group">
          <span className="logo-icon">🖐️</span>
          <div className="title-group">
            <h1>HAND GESTURE KEYBOARD</h1>
            <span className="version-tag">PRO v1.0</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={resetCalibration} className="reset-btn">Reset Calib</button>
          <div className={`status-badge ${connectionStatus}`}>
            {connectionStatus.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-top">
          <section className="preview-section">
            <HandCanvas trackingData={trackingData} />
            <div className={`calib-indicator ${isCalibrating ? 'active' : ''}`}>
              TARGET CALIBRATED!
            </div>
            <div className="calibration-controls">
              <button onMouseEnter={() => setCurrentHoverKey('F')} onClick={() => requestCalibration('F')} className="calib-btn">
                <span>F</span> Auto-Calib (2s)
              </button>
              <button onMouseEnter={() => setCurrentHoverKey('J')} onClick={() => requestCalibration('J')} className="calib-btn">
                <span>J</span> Auto-Calib (2s)
              </button>
            </div>
          </section>

          <section className="info-section">
            <div className="text-display-container">
              <div className="display-header">
                <h3>📝 입력된 텍스트</h3>
                <div className="header-badges">
                  <span className={`gest-badge ${trackingData?.gestures?.pinch?.is_pinching ? 'pinch' : ''}`}>PINCH</span>
                  <span className={`lang-tag ${isKorean ? 'ko' : 'en'}`}>
                    {isKorean ? '한글' : 'ENG'}
                  </span>
                </div>
              </div>
              <div className="text-display" id="composed-text-area">
                {composedText}
                <span className="cursor">|</span>
              </div>
            </div>

            <div className="instructions">
              <h4>📖 사용 가이드</h4>
              <ul>
                <li><span>☝️</span> <strong>포인팅:</strong> 검지로 키 위에 조준</li>
                <li><span>🤏</span> <strong>입력:</strong> 엄지+검지 핀치 (딸깍)</li>
                <li><span>⏱️</span> <strong>체류:</strong> 0.8초 머무르면 입력</li>
                <li><span>✊</span> <strong>삭제:</strong> 주먹 쥐면 전체 삭제</li>
                <li><span>🎯</span> <strong>교정:</strong> F/J 키에 2초간 머무르기</li>
              </ul>
            </div>
          </section>
        </div>

        <section className="keyboard-section">
          <VirtualKeyboard
            onKeyPress={handleKeyPress}
            isKorean={isKorean}
            currentHoverKeys={currentHoverKeys}
            dwellProgresses={dwellProgresses}
          />
        </section>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
            --primary: #00d2ff;
            --secondary: #3a7bd5;
            --accent: #00ff88;
            --danger: #ff4b2b;
            --bg-gradient: radial-gradient(circle at top right, #1e1e2f, #111119);
            --glass: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
        }
        
        body { margin: 0; background: #0b0b0f; overflow: hidden; }

        .app-container {
          min-height: 100vh;
          background: var(--bg-gradient);
          color: white;
          font-family: 'Inter', 'Segoe UI', 'Malgun Gothic', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
        }

        /* Loading Overlay */
        .loading-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10, 10, 15, 0.95);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
        }

        .loader {
            width: 80px; height: 80px;
            border: 5px solid var(--glass-border);
            border-top: 5px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
            box-shadow: 0 0 30px rgba(0, 210, 255, 0.2);
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Header */
        .app-header {
          display: flex;
          width: 100%;
          max-width: 1200px;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .logo-group { display: flex; align-items: center; gap: 20px; }
        .logo-icon { font-size: 3rem; filter: drop-shadow(0 0 10px var(--primary)); }
        
        .title-group h1 { margin: 0; font-size: 1.5rem; letter-spacing: 2px; color: #fff; font-weight: 800; }
        .version-tag { font-size: 0.7rem; color: var(--primary); font-weight: bold; opacity: 0.8; }

        .header-actions { display: flex; gap: 15px; align-items: center; }
        .reset-btn {
            background: rgba(255, 75, 43, 0.1);
            border: 1px solid rgba(255, 75, 43, 0.3);
            color: var(--danger);
            padding: 8px 16px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s;
        }
        .reset-btn:hover { background: var(--danger); color: white; }

        .status-badge {
          padding: 8px 20px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 1px;
          background: var(--glass);
          border: 1px solid var(--glass-border);
        }
        .status-badge.connected { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 15px rgba(0, 255, 136, 0.1); }
        .status-badge.error { color: var(--danger); border-color: var(--danger); }
        
        /* Main Layout */
        .app-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 1200px;
        }

        .main-top {
            display: flex;
            gap: 24px;
            height: 520px;
        }

        /* Preview Section */
        .preview-section {
            flex: 1.4;
            position: relative;
            background: #000;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: var(--shadow);
            border: 1px solid var(--glass-border);
        }

        .calib-indicator {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0.8);
            background: var(--accent);
            color: black;
            padding: 12px 24px;
            border-radius: 40px;
            font-weight: bold;
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 100;
        }
        .calib-indicator.active { opacity: 1; transform: translate(-50%, -50%) scale(1); }

        .calibration-controls {
            position: absolute;
            bottom: 24px; left: 24px;
            display: flex; gap: 12px;
            z-index: 10;
        }

        .calib-btn {
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid var(--primary);
            color: white;
            padding: 10px 18px;
            border-radius: 14px;
            cursor: pointer;
            backdrop-filter: blur(8px);
            font-size: 0.85rem;
            transition: all 0.2s;
            display: flex; align-items: center; gap: 8px;
        }
        .calib-btn span { background: var(--primary); color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .calib-btn:hover { background: var(--primary); color: #000; }
        .calib-btn:hover span { background: #000; color: var(--primary); }

        /* Info Section */
        .info-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .text-display-container {
            flex: 1.5;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 28px;
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow);
        }

        .display-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .display-header h3 { margin: 0; color: #fff; font-size: 1rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
        
        .header-badges { display: flex; gap: 10px; align-items: center; }
        .gest-badge { font-size: 0.7rem; font-weight: 900; color: #555; border: 1px solid #333; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; }
        .gest-badge.pinch { color: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px rgba(0, 255, 136, 0.2); }

        .lang-tag {
            padding: 4px 14px;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 800;
        }
        .lang-tag.ko { background: #ff4757; color: white; }
        .lang-tag.en { background: #2f3542; color: #00d2ff; border: 1px solid #00d2ff; }

        .text-display {
          flex: 1;
          font-size: 2.5rem;
          color: white;
          white-space: pre-wrap;
          word-break: break-all;
          overflow-y: auto;
          line-height: 1.4;
          padding-right: 10px;
        }
        .text-display::-webkit-scrollbar { width: 6px; }
        .text-display::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 10px; }
        
        .cursor { color: var(--accent); animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }

        /* Instructions */
        .instructions {
            flex: 1;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 24px;
            padding: 24px;
            border: 1px solid var(--glass-border);
        }
        .instructions h4 { margin: 0 0 16px 0; color: #ffa502; font-size: 0.9rem; text-transform: uppercase; }
        .instructions ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr; gap: 12px; }
        .instructions li { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; color: #a4b0be; }
        .instructions li span { font-size: 1.2rem; min-width: 24px; text-align: center; }
        .instructions b { color: #fff; }

        .keyboard-section {
            width: 100%;
        }
      `}} />
    </div>
  );
}

export default App;
