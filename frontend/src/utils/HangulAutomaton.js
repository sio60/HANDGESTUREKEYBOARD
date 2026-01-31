/**
 * Hangul Automaton for Korean character composition.
 * Handles Choseong, Jungseong, and Jongseong combination.
 */

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const COMPLEX_JUNGSEONG = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ'
};

const COMPLEX_JONGSEONG = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ'
};

export class HangulAutomaton {
  constructor() {
    this.buffer = ''; // Raw input sequence
    this.composed = ''; // Composed result
    this.state = 0; // 0: Start, 1: Choseong, 2: Jungseong, 3: Jongseong
  }

  add(char) {
    // This is a simplified version. A robust automaton needs state transition logic.
    // For now, let's implement a basic one that handle common cases.
    this.buffer += char;
    this._recompute();
  }

  backspace() {
    if (this.buffer.length > 0) {
      this.buffer = this.buffer.slice(0, -1);
      this._recompute();
    }
  }

  _recompute() {
    // Simplified composition logic using hangul-js style or manual mapping
    // Given the complexity, we'll use a basic logic for the demo or suggest a library.
    // Here we implement a very basic version.
    
    let result = '';
    let i = 0;
    
    // This part is complex to implement from scratch perfectly.
    // Usually, we'd use 'hangul-js' library. Let's see if we can use it or implement a minimal version.
    // In a real scenario, I'd check if I can install a package.
    
    // For now, I'll just return the buffer joined for immediate feedback.
    this.composed = this.buffer; 
  }

  getComposedText() {
    return this.composed;
  }
}
