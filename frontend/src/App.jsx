import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import VirtualKeyboard from './components/VirtualKeyboard';
import HandCanvas from './components/HandCanvas';
import { HangulAutomaton } from './utils/HangulAutomaton';

function App() {
  const [trackingData, setTrackingData] = useState(null);
  const [composedText, setComposedText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const automatonRef = useRef(new HangulAutomaton());
  const wsRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/hand-tracking');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to backend');
        setConnectionStatus('connected');
        // Request video frame as well
        ws.send(JSON.stringify({ type: 'config', send_video: true }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'tracking') {
          setTrackingData(data);

          // Check for pinch trigger to simulate key press
          if (data.gestures?.pinch?.pinch_triggered) {
            handlePinch(data.pointer);
          }
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from backend');
        setConnectionStatus('disconnected');
        setTimeout(connect, 3000); // Reconnect after 3s
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setConnectionStatus('error');
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleKeyPress = useCallback((key) => {
    if (key === 'Space') {
      automatonRef.current.add(' ');
    } else if (key === 'Bksp') {
      automatonRef.current.backspace();
    } else {
      automatonRef.current.add(key);
    }
    setComposedText(automatonRef.current.getComposedText());
  }, []);

  const handlePinch = (pointer) => {
    if (!pointer) return;

    // Convert normalized pointer to screen coordinates and find the key
    const [nx, ny] = pointer;
    // This is a simplified hit-testing. 
    // In a real app, we'd use document.elementFromPoint or geometry checks.
    // For now, let's assume the keyboard component handles its own hits if needed 
    // or we use a global event.

    // We can use document.elementFromPoint(nx * window.innerWidth, ny * window.innerHeight)
    // but the canvas and keyboard might be scaled.
    // Let's implement a simple ID-based trigger for the demo.
    const x = nx * window.innerWidth;
    const y = ny * window.innerHeight;
    const element = document.elementFromPoint(x, y);

    if (element && element.classList.contains('keyboard-key')) {
      const key = element.innerText;
      handleKeyPress(key);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🖐️ HAND GESTURE KEYBOARD</h1>
        <div className={`status-badge ${connectionStatus}`}>
          {connectionStatus.toUpperCase()}
        </div>
      </header>

      <main className="app-main">
        <section className="preview-section">
          <HandCanvas trackingData={trackingData} />
        </section>

        <section className="input-section">
          <div className="text-display">
            {composedText}
            <span className="cursor">|</span>
          </div>
          <VirtualKeyboard onKeyPress={handleKeyPress} activePointer={trackingData?.pointer} />
        </section>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }
        .app-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }
        .status-badge {
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        .status-badge.connected { background: #4caf50; }
        .status-badge.disconnected { background: #f44336; }
        .status-badge.error { background: #ff9800; }
        
        .app-main {
          display: flex;
          flex-direction: column;
          gap: 30px;
          width: 100%;
          max-width: 1000px;
        }
        
        .text-display {
          background: rgba(0, 0, 0, 0.4);
          padding: 20px;
          border-radius: 12px;
          min-height: 80px;
          font-size: 2rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .cursor {
          animation: blink 1s step-end infinite;
        }
        
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}} />
    </div>
  );
}

export default App;
