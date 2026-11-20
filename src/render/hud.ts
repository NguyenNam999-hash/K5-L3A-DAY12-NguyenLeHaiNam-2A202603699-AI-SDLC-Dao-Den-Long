import type { Game } from '../core/game';
import { TUNING } from '../core/tuning';

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

export class Hud {
  private readonly root = el<HTMLDivElement>('#hud');
  private readonly flames = el<HTMLDivElement>('#flames');
  private readonly lanternDots = el<HTMLDivElement>('#lantern-dots');
  private readonly carry = el<HTMLSpanElement>('#carry');
  private readonly timer = el<HTMLDivElement>('#timer');
  private readonly score = el<HTMLDivElement>('#score');
  private readonly hint = el<HTMLDivElement>('#hint');
  private readonly pulseFill = el<HTMLDivElement>('#pulse-fill');
  private readonly pulseCost = el<HTMLSpanElement>('#pulse-cost');
  private readonly overlay = el<HTMLDivElement>('#overlay');
  private readonly overlayTitle = el<HTMLHeadingElement>('#overlay-title');
  private readonly overlayEyebrow = el<HTMLParagraphElement>('#overlay-eyebrow');
  private readonly overlayReason = el<HTMLParagraphElement>('#overlay-reason');
  private readonly overlayScore = el<HTMLSpanElement>('#overlay-score');
  private readonly overlayBreakdown = el<HTMLDivElement>('#overlay-breakdown');

  private flamePips: HTMLDivElement[] = [];
  private lanternPips: HTMLDivElement[] = [];
  private lastHint = '';

  constructor() {
    for (let i = 0; i < TUNING.flames; i += 1) {
      const pip = document.createElement('div');
      pip.className = 'pip flame';
      this.flames.appendChild(pip);
      this.flamePips.push(pip);
    }
    for (let i = 0; i < TUNING.lantern_count_night1; i += 1) {
      const pip = document.createElement('div');
      pip.className = 'pip lantern';
      this.lanternDots.appendChild(pip);
      this.lanternPips.push(pip);
    }
    this.pulseCost.textContent = `${TUNING.pulse_cost} ánh sáng`;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  update(game: Game): void {
    this.flamePips.forEach((pip, i) => pip.classList.toggle('on', i < game.flames));
    const lit = game.lanterns.filter((l) => l.lit).length;
    this.lanternPips.forEach((pip, i) => pip.classList.toggle('on', i < lit));

    this.carry.textContent = `${game.carried} / ${TUNING.carry_capacity}`;
    this.timer.textContent = formatTime(game.timeLeft());
    this.timer.classList.toggle('low', game.timeLeft() < 60);
    this.score.textContent = `${game.score.toLocaleString('en-US')} điểm`;

    const cooldown = TUNING.pulse_cooldown_s;
    const ready = game.pulseCd <= 0 && game.carried >= TUNING.pulse_cost;
    const progress = cooldown > 0 ? Math.max(0, 1 - game.pulseCd / cooldown) : 0;
    this.pulseFill.style.width = `${game.carried < TUNING.pulse_cost ? 0 : progress * 100}%`;
    this.pulseFill.classList.toggle('cooling', game.pulseCd > 0);

    this.setHint(this.buildHint(game));
  }

  private buildHint(game: Game): string {
    if (game.state === 'won') return 'Năm ngọn đèn đã sáng';
    if (game.state === 'lost') return 'Đêm đã khép lại';

    let nearest: { id: string; dist: number; need: number } | null = null;
    for (const lantern of game.lanterns) {
      if (lantern.lit) continue;
      const dist = Math.hypot(lantern.x - game.px, lantern.z - game.pz);
      if (dist <= TUNING.interact_radius && (!nearest || dist < nearest.dist)) {
        nearest = { id: lantern.id, dist, need: Math.max(0, TUNING.lantern_cost - lantern.deposited) };
      }
    }
    if (nearest) {
      if (game.carried >= nearest.need) return `E · Thắp đèn ${nearest.id}`;
      return `Đèn ${nearest.id} cần thêm ${nearest.need - game.carried} đom đóm`;
    }
    if (game.carried >= TUNING.carry_capacity) return 'Đã đầy ánh sáng — mang về Đèn Lồng Lớn';
    if (game.carried >= TUNING.lantern_cost && game.lanterns.some((l) => !l.lit)) {
      return 'Đủ ánh sáng để thắp một ngọn đèn';
    }
    if (game.carried > 0) return `Đang mang ${game.carried} đom đóm`;
    return 'Đi qua đom đóm để nhặt ánh sáng';
  }

  private setHint(text: string): void {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hint.textContent = text;
    this.hint.classList.toggle('show', text.length > 0);
  }

  showOverlay(game: Game): void {
    const won = game.state === 'won';
    this.overlayEyebrow.textContent = won ? 'Đêm 1 · Hoàn thành' : 'Đêm 1 · Kết thúc';
    this.overlayTitle.textContent = won ? 'Đảo đã sáng' : 'Sương vẫn còn dày';
    this.overlayReason.textContent = won
      ? 'Năm ngọn đèn cháy vàng. Sương đen tan dần khỏi Đảo Bến, và Mây ngồi xuống bên bến đò chờ bình minh.'
      : game.flames <= 0
        ? 'Ngọn lửa cuối cùng đã tắt. Bóng Mực quấn lấy Mây, và đảo chìm lại vào sương.'
        : 'Bình minh đến khi đảo còn tối. Đêm nay đảo vẫn chưa đủ sáng.';

    const timeBonus = Math.round(game.timeLeft() * TUNING.score.per_second_left);
    const flameBonus = game.flames * TUNING.score.per_flame_left;

    this.overlayScore.textContent = game.score.toLocaleString('en-US');
    this.overlayBreakdown.innerHTML = [
      ['Đom đóm', `${game.stats.motes} × ${TUNING.score.per_mote}`, game.stats.motes * TUNING.score.per_mote],
      ['Đèn đã thắp', `${game.stats.lanterns} × ${TUNING.score.per_lantern}`, game.stats.lanterns * TUNING.score.per_lantern],
      ['Làm choáng Bóng Mực', `${game.stats.stuns} × ${TUNING.score.per_stun}`, game.stats.stuns * TUNING.score.per_stun],
      ['Thời gian còn lại', formatTime(game.timeLeft()), timeBonus],
      ['Ngọn lửa còn lại', `${game.flames} × ${TUNING.score.per_flame_left}`, flameBonus],
    ]
      .map(
        ([label, detail, value]) =>
          `<div><span>${label} <em style="opacity:.6;font-style:normal">${detail}</em></span><span>${(value as number).toLocaleString('en-US')}</span></div>`,
      )
      .join('')
      + `<div><span>Tổng cộng</span><span>${game.score.toLocaleString('en-US')}</span></div>`;

    this.overlay.hidden = false;
  }
}
