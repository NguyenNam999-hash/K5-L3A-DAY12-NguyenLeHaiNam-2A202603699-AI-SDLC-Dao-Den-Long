import type { Game } from '../core/game';
import { DT, TUNING } from '../core/tuning';
import type { NightId } from '../core/types';

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const NIGHT_NAMES: Record<NightId, string> = { 1: 'Đảo Bến', 2: 'Đảo Cau', 3: 'Đảo Chuông' };

export class Hud {
  private readonly root = el<HTMLDivElement>('#hud');
  private readonly flames = el<HTMLDivElement>('#flames');
  private readonly lanternCount = el<HTMLSpanElement>('#lantern-count');
  private readonly lanternDots = el<HTMLDivElement>('#lantern-dots');
  private readonly carryCells = el<HTMLDivElement>('#carry-cells');
  private readonly carryText = el<HTMLSpanElement>('#carry-text');
  private readonly timer = el<HTMLDivElement>('#timer');
  private readonly score = el<HTMLDivElement>('#score');
  private readonly hint = el<HTMLDivElement>('#hint');
  private readonly dashFill = el<HTMLDivElement>('#dash-fill');
  private readonly pulseFill = el<HTMLDivElement>('#pulse-fill');
  private readonly dashLabel = el<HTMLDivElement>('#dash-label');
  private readonly pulseLabel = el<HTMLDivElement>('#pulse-label');
  private readonly charmTag = el<HTMLDivElement>('#charm-tag');
  private readonly windTag = el<HTMLDivElement>('#wind-tag');
  private readonly pauseBadge = el<HTMLDivElement>('#pause-badge');
  private readonly pauseText = el<HTMLSpanElement>('#pause-text');
  private readonly nightTag = el<HTMLDivElement>('#night-tag');
  private readonly difficultyTag = el<HTMLDivElement>('#difficulty-tag');
  private readonly arrow = el<HTMLDivElement>('#lantern-arrow');
  private readonly overlay = el<HTMLDivElement>('#overlay');
  private readonly overlayEyebrow = el<HTMLParagraphElement>('#overlay-eyebrow');
  private readonly overlayTitle = el<HTMLHeadingElement>('#overlay-title');
  private readonly overlayReason = el<HTMLParagraphElement>('#overlay-reason');
  private readonly overlayScore = el<HTMLSpanElement>('#overlay-score');
  private readonly overlayBreakdown = el<HTMLDivElement>('#overlay-breakdown');
  private readonly continueBtn = el<HTMLButtonElement>('#continue-btn');
  private readonly retryBtn = el<HTMLButtonElement>('#retry-btn');
  private readonly menuBtn = el<HTMLButtonElement>('#to-menu-btn');

  private flamePips: HTMLDivElement[] = [];
  private lanternPips: HTMLDivElement[] = [];
  private carryCellEls: HTMLDivElement[] = [];
  private lastHint = '';
  private lastPause: string | null = null;

  constructor() {
    this.setupNight(1, 5);
    this.continueBtn.hidden = true;
    this.retryBtn.hidden = true;
    this.menuBtn.hidden = true;
  }

  setupNight(night: NightId, lanterns: number): void {
    this.flames.replaceChildren();
    this.flamePips = [];
    for (let i = 0; i < TUNING.flames; i += 1) {
      const pip = document.createElement('div');
      pip.className = 'pip flame';
      this.flames.appendChild(pip);
      this.flamePips.push(pip);
    }
    this.lanternDots.replaceChildren();
    this.lanternPips = [];
    for (let i = 0; i < lanterns; i += 1) {
      const pip = document.createElement('div');
      pip.className = 'pip lantern';
      this.lanternDots.appendChild(pip);
      this.lanternPips.push(pip);
    }
    this.carryCells.replaceChildren();
    this.carryCellEls = [];
    for (let i = 0; i < TUNING.carry_capacity; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      this.carryCells.appendChild(cell);
      this.carryCellEls.push(cell);
    }
    this.nightTag.textContent = `Đêm ${night} · ${NIGHT_NAMES[night]}`;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  setPaused(text: string | null): void {
    if (text === this.lastPause) return;
    this.lastPause = text;
    if (text) this.pauseText.textContent = text;
    this.pauseBadge.hidden = text === null;
  }

  setDifficulty(label: string): void {
    this.difficultyTag.textContent = `Độ khó: ${label}`;
  }

  /** Screen-space arrow toward the nearest unlit lantern. */
  setArrow(angleDeg: number | null, distance: number): void {
    if (angleDeg === null) {
      this.arrow.hidden = true;
      return;
    }
    this.arrow.hidden = false;
    this.arrow.style.transform = `rotate(${angleDeg}deg)`;
    this.arrow.dataset.distance = `${Math.round(distance)} m`;
  }

  update(game: Game): void {
    this.flamePips.forEach((pip, i) => pip.classList.toggle('on', i < game.flames));
    const lit = game.lanterns.filter((l) => l.lit).length;
    this.lanternPips.forEach((pip, i) => pip.classList.toggle('on', i < lit));
    this.lanternCount.textContent = `${lit}/${game.lanterns.length}`;

    this.carryCellEls.forEach((cell, i) => {
      cell.classList.toggle('on', i < game.carried);
      cell.classList.toggle('charm', game.charmTicks > 0 && i < game.carried);
    });
    this.carryText.textContent = `${game.carried} / ${TUNING.carry_capacity}`;

    const left = game.timeLeft();
    this.timer.textContent = formatTime(left);
    this.timer.classList.toggle('low', left <= 30);
    this.score.textContent = `${game.score.toLocaleString('en-US')} điểm`;

    const dashCd = TUNING.dash_cooldown_s;
    const dashProgress = dashCd > 0 ? Math.max(0, 1 - game.dashCdTicks * DT / dashCd) : 1;
    this.dashFill.style.width = `${game.charmTicks > 0 ? 100 : dashProgress * 100}%`;
    this.dashFill.classList.toggle('ready', game.dashCdTicks <= 0);
    this.dashLabel.textContent = game.charmTicks > 0 ? 'Lướt · Bùa Gió' : 'Lướt [Shift]';

    const pulseProgress = TUNING.pulse_cooldown_s > 0 ? Math.max(0, 1 - game.pulseCdTicks * DT / TUNING.pulse_cooldown_s) : 1;
    this.pulseFill.style.width = `${game.carried < TUNING.pulse_cost ? 0 : pulseProgress * 100}%`;
    this.pulseFill.classList.toggle('ready', game.pulseCdTicks <= 0 && game.carried >= TUNING.pulse_cost);
    this.pulseLabel.textContent = `Tỏa sáng [F] · ${TUNING.pulse_cost}`;

    this.charmTag.hidden = game.charmTicks <= 0;
    if (game.charmTicks > 0) this.charmTag.textContent = `Bùa Gió ${Math.ceil(game.charmTicks * DT)} s`;
    this.windTag.hidden = !game.wind.active && !game.windWarning;
    if (game.wind.active) this.windTag.textContent = `Gió mạnh · ${Math.round(game.wind.dirDeg)}°`;
    else if (game.windWarning) this.windTag.textContent = 'Gió sắp tới';

    this.setHint(this.buildHint(game));
  }

  private buildHint(game: Game): string {
    if (game.state === 'won') return 'Đêm đã sáng';
    if (game.state === 'lost') return 'Đêm đã khép lại';

    let nearest: { dist: number; deposited: number } | null = null;
    for (const lantern of game.lanterns) {
      if (lantern.lit) continue;
      const d = Math.hypot(lantern.x - game.px, lantern.y - (game.py + 1), lantern.z - game.pz);
      if (d <= TUNING.interact_radius && (!nearest || d < nearest.dist)) {
        nearest = { dist: d, deposited: lantern.deposited };
      }
    }
    if (nearest && game.carried > 0) {
      return `E — Nạp ánh sáng (${nearest.deposited}/${TUNING.lantern_cost})`;
    }
    if (nearest) return `Đèn cần ${TUNING.lantern_cost - nearest.deposited} đom đóm nữa`;
    if (game.carried >= TUNING.carry_capacity) return 'Đã đầy ánh sáng — mang về Đèn Lồng Lớn';
    if (game.carried > 0) return `Đang mang ${game.carried} đom đóm`;
    return 'Đi qua đom đóm để nhặt ánh sáng';
  }

  private setHint(text: string): void {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hint.textContent = text;
    this.hint.classList.toggle('show', text.length > 0);
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
  }

  showResult(game: Game, night: NightId, totalScore: number, final: boolean): void {
    const won = game.state === 'won';
    const nightName = NIGHT_NAMES[night];
    this.overlayEyebrow.textContent = `Đêm ${night} · ${won ? 'Hoàn thành' : 'Kết thúc'}`;
    this.overlayTitle.textContent = won ? `${nightName} đã sáng` : 'Sương vẫn còn dày';
    this.overlayReason.textContent = won
      ? final
        ? 'Ngọn đèn cuối cùng bừng lên. Ba hòn đảo nối nhau bằng ánh vàng, và bình minh đã tới.'
        : `Những ngọn đèn của ${nightName} đã cháy. Con đường sang hòn đảo kế tiếp hiện ra trong sương.`
      : game.flames <= 0
        ? 'Ngọn lửa cuối cùng đã tắt. Bóng Mực quấn lấy Mây, và hòn đảo chìm lại vào sương.'
        : 'Bình minh đến khi đảo còn tối. Đêm nay đảo vẫn chưa đủ sáng.';

    const timeBonus = won ? Math.floor(game.timeLeft()) * TUNING.score.per_second_left : 0;
    const flameBonus = won ? game.flames * TUNING.score.per_flame_left : 0;
    const rows: Array<[string, string, number]> = [
      ['Đom đóm đã nạp', `${game.stats.motes} × ${TUNING.score.per_mote}`, game.stats.motes * TUNING.score.per_mote],
      ['Đèn đã thắp', `${game.stats.lanterns} × ${TUNING.score.per_lantern}`, game.stats.lanterns * TUNING.score.per_lantern],
      ['Bóng Mực trúng Tỏa Sáng', `${game.stats.stuns} × ${TUNING.score.per_stun}`, game.stats.stuns * TUNING.score.per_stun],
      ['Thời gian còn lại', formatTime(game.timeLeft()), timeBonus],
      ['Ngọn lửa còn lại', `${game.flames} × ${TUNING.score.per_flame_left}`, flameBonus],
    ];
    if (won && night > 1) rows.push(['Điểm các đêm trước', '', totalScore - game.score]);

    this.overlayScore.textContent = totalScore.toLocaleString('en-US');
    this.overlayBreakdown.innerHTML =
      rows
        .filter(([, , value]) => value !== 0 || true)
        .map(
          ([label, detail, value]) =>
            `<div><span>${label} <em style="opacity:.6;font-style:normal">${detail}</em></span><span>${value.toLocaleString('en-US')}</span></div>`,
        )
        .join('') +
      `<div><span>Đêm nay</span><span>${game.score.toLocaleString('en-US')}</span></div>` +
      `<div><span>Tổng cộng</span><span>${totalScore.toLocaleString('en-US')}</span></div>`;

    this.continueBtn.hidden = !won;
    this.continueBtn.textContent = final ? 'Xem bình minh' : 'Đêm kế tiếp';
    this.retryBtn.hidden = won;
    this.menuBtn.hidden = false;
    this.overlay.dataset.night = String(night);
    this.overlay.dataset.won = String(won);
    this.overlay.hidden = false;
  }

  showSunrise(total: number): void {
    this.overlayEyebrow.textContent = 'Bình minh';
    this.overlayTitle.textContent = 'Ba hòn đảo đã sáng';
    this.overlayReason.textContent =
      'Ông Đăng đứng trên bến, nhìn ba vầng sáng nối liền nhau giữa biển mây. Đêm nay, không còn ngọn đèn nào phải chờ.';
    this.overlayScore.textContent = total.toLocaleString('en-US');
    this.overlayBreakdown.innerHTML = `<div><span>Tổng điểm ba đêm</span><span>${total.toLocaleString('en-US')}</span></div>`;
    this.continueBtn.hidden = true;
    this.retryBtn.hidden = true;
    this.menuBtn.hidden = false;
    this.menuBtn.textContent = 'Về menu';
    this.overlay.hidden = false;
  }
}
