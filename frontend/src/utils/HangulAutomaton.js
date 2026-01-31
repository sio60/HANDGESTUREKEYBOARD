const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export class HangulAutomaton {
  constructor() {
    this.typedText = '';
    this.buffer = { cho: '', jung: '', jong: '' };
  }

  combineHangul(cho, jung, jong) {
    const c = CHO.indexOf(cho);
    const j = JUNG.indexOf(jung);
    const jj = jong ? JONG.indexOf(jong) : 0;
    if (c === -1 || j === -1) return '';
    return String.fromCharCode(0xAC00 + (c * 21 + j) * 28 + jj);
  }

  isCho(ch) { return CHO.includes(ch); }
  isJung(ch) { return JUNG.includes(ch); }

  add(ch) {
    if (ch === ' ') {
      this.flush();
      this.typedText += ' ';
      return;
    }

    if (this.isCho(ch)) {
      if (!this.buffer.cho) {
        this.buffer.cho = ch;
      } else if (this.buffer.cho && this.buffer.jung && !this.buffer.jong) {
        this.buffer.jong = ch;
      } else if (this.buffer.cho && this.buffer.jung && this.buffer.jong) {
        // 기존 글자 완성 후 새로운 초성으로 시작
        this.typedText += this.combineHangul(this.buffer.cho, this.buffer.jung, this.buffer.jong);
        this.buffer = { cho: ch, jung: '', jong: '' };
      } else {
        // 초성만 있는데 또 초성이 들어온 경우 (예: ㄱㄱ)
        if (this.buffer.cho) this.typedText += this.buffer.cho;
        this.buffer = { cho: ch, jung: '', jong: '' };
      }
    } else if (this.isJung(ch)) {
      if (this.buffer.cho && !this.buffer.jung) {
        this.buffer.jung = ch;
      } else if (this.buffer.cho && this.buffer.jung && this.buffer.jong) {
        // 종성이 있는 상태에서 중성이 들어오면, 종성을 다음 글자의 초성으로 이동
        const prevJong = this.buffer.jong;
        this.buffer.jong = '';
        this.typedText += this.combineHangul(this.buffer.cho, this.buffer.jung, '');
        this.buffer = { cho: prevJong, jung: ch, jong: '' };
      } else {
        // 초성 없이 중성만 들어온 경우
        this.flush();
        this.typedText += ch;
      }
    } else {
      this.flush();
      this.typedText += ch;
    }
  }

  backspace() {
    if (this.buffer.jong) {
      this.buffer.jong = '';
    } else if (this.buffer.jung) {
      this.buffer.jung = '';
    } else if (this.buffer.cho) {
      this.buffer.cho = '';
    } else {
      this.typedText = this.typedText.slice(0, -1);
    }
  }

  clear() {
    this.typedText = '';
    this.buffer = { cho: '', jung: '', jong: '' };
  }

  flush() {
    if (this.buffer.cho) {
      if (this.buffer.jung) {
        this.typedText += this.combineHangul(this.buffer.cho, this.buffer.jung, this.buffer.jong);
      } else {
        this.typedText += this.buffer.cho;
      }
      this.buffer = { cho: '', jung: '', jong: '' };
    }
  }

  getComposedText() {
    let display = this.typedText;
    if (this.buffer.cho) {
      if (this.buffer.jung) {
        display += this.combineHangul(this.buffer.cho, this.buffer.jung, this.buffer.jong);
      } else {
        display += this.buffer.cho;
      }
    }
    return display;
  }
}
