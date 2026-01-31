import React from 'react';

const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWELS = ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅔ'];

const VirtualKeyboard = ({ onKeyPress, activePointer }) => {
    const allKeys = [...CONSONANTS, ...VOWELS, 'Space', 'Bksp'];

    return (
        <div className="virtual-keyboard">
            {allKeys.map((key) => (
                <div
                    key={key}
                    id={`key-${key}`}
                    className="keyboard-key"
                    onClick={() => onKeyPress(key)}
                >
                    {key}
                </div>
            ))}
            <style dangerouslySetInnerHTML={{
                __html: `
        .virtual-keyboard {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          backdrop-filter: blur(10px);
          max-width: 600px;
          margin: 20px auto;
        }
        .keyboard-key {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 60px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .keyboard-key:hover {
          background: rgba(255, 255, 255, 0.4);
          transform: translateY(-2px);
        }
        .keyboard-key.active {
          background: #4facfe;
          box-shadow: 0 0 15px #4facfe;
        }
      `}} />
        </div>
    );
};

export default VirtualKeyboard;
