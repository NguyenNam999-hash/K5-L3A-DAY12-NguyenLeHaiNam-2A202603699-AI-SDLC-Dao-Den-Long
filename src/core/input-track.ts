import { IDLE_INPUT, type InputFrame } from './types';
import type { InputFrameSpec } from './scenario';

/**
 * Holds the current input and applies frames as the simulation reaches their tick.
 * Missing fields inherit the previous value (contract section C).
 */
export class InputTrack {
  private readonly frames: InputFrameSpec[];
  private index = 0;
  current: InputFrame = { ...IDLE_INPUT };

  constructor(frames: InputFrameSpec[] = []) {
    this.frames = frames;
  }

  /** Apply every frame scheduled at or before `tick`. */
  advanceTo(tick: number): InputFrame {
    while (this.index < this.frames.length) {
      const frame = this.frames[this.index]!;
      if (frame.tick > tick) break;
      this.index += 1;
      if (frame.move) {
        this.current.moveX = frame.move[0];
        this.current.moveZ = frame.move[1];
      }
      if (frame.cam_yaw_deg !== undefined) this.current.camYawDeg = frame.cam_yaw_deg;
      if (frame.jump !== undefined) this.current.jump = frame.jump;
      if (frame.interact !== undefined) this.current.interact = frame.interact;
      if (frame.pulse !== undefined) this.current.pulse = frame.pulse;
    }
    return this.current;
  }
}
