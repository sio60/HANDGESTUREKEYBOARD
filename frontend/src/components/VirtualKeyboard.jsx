import React from 'react';

const KEYBOARD_EN = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '←'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⏎'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?'],
  ['한/영', 'SPACE']
];

const KEYBOARD_KO = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '←'],
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ', '⏎'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', ',', '.', '?'],
  ['한/영', 'SPACE']
];

const VirtualKeyboard = ({ onKeyPress, isKorean, currentHoverKeys, dwellProgresses }) => {
  const layout = isKorean ? KEYBOARD_KO : KEYBOARD_EN;

  const getKeyClass = (key) => {
    let classes = 'keyboard-key';
    if (key === 'SPACE') classes += ' space';
    else if (key === '한/영' || key === '←' || key === '⏎') classes += ' wide';

    // 한 손이라도 호버 중이면 hovering 클래스 추가
    const isHovering = Object.values(currentHoverKeys).some(k => k === key);
    if (isHovering) classes += ' hovering';
    return classes;
  };

  return (
    <div className="virtual-keyboard-container">
      <div className="keyboard">
        {layout.map((row, i) => (
          <div key={i} className="keyboard-row">
            {row.map((key) => (
              <div
                key={key}
                id={`key-${key}`}
                data-key={key}
                className={getKeyClass(key)}
                onClick={() => onKeyPress(key)}
              >
                {key === 'SPACE' ? '␣ Space' : key}
                {/* 각 손의 모든 손가락별 인디케이터 표시 */}
                {Object.entries(currentHoverKeys).map(([handLabel, fingers]) => (
                  Object.entries(fingers).map(([f_name, hoverKey]) => {
                    const progress = dwellProgresses[handLabel][f_name];
                    if (hoverKey === key && progress > 0) {
                      return (
                        <div
                          key={`${handLabel}-${f_name}`}
                          className={`dwell-indicator ${handLabel.toLowerCase()}`}
                          style={{
                            width: `${progress * 100}%`,
                            bottom: `${['thumb', 'index', 'middle', 'ring', 'pinky'].indexOf(f_name) * 2}px`
                          }}
                        />
                      );
                    }
                    return null;
                  })
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .virtual-keyboard-container {
            margin-top: 15px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 20px;
            padding: 20px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .keyboard {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
        }
        .keyboard-row {
            display: flex;
            gap: 6px;
            justify-content: center;
        }
        .keyboard-key {
            position: relative;
            width: 55px;
            height: 55px;
            background: linear-gradient(145deg, rgba(58, 58, 74, 0.8), rgba(42, 42, 58, 0.8));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 1.1rem;
            font-weight: bold;
            transition: all 0.15s;
            cursor: pointer;
            overflow: hidden;
        }
        .keyboard-key.wide {
            width: 90px;
        }
        .keyboard-key.space {
            width: 300px;
        }
        .keyboard-key:hover, .keyboard-key.hovering {
            background: linear-gradient(145deg, rgba(74, 74, 90, 0.9), rgba(58, 58, 74, 0.9));
            border-color: #00d9ff;
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 217, 255, 0.3);
        }
        .keyboard-key.hovering {
            animation: pulse 0.3s ease-in-out infinite;
        }
        .dwell-indicator {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 4px;
            transition: width 0.1s linear;
        }
        .dwell-indicator.left {
            background: #ff4757;
        }
        .dwell-indicator.right {
            background: #2ed573;
        }
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
            50% { box-shadow: 0 0 25px rgba(0, 255, 136, 0.8); }
        }
      `}} />
    </div>
  );
};

export default VirtualKeyboard;
