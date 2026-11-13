// Text-reminder ("nagging") engine gate. Deliberately independent of practice code:
// nothing in the trainer, scroll feed or error review imports this module, and this module
// imports only the pure DayStatus type. The Sendblue sender, scheduler and ladder (M2) live here.
import type { DayStatus } from "../plan";

export interface NagInput {
  /** households.texts_enabled: the parent's master switch. Default off. */
  textsEnabled: boolean;
  status: Pick<DayStatus, "complete">;
}

/** Whether the engine may send a reminder right now. Off switch wins; a complete day stops nagging. */
export function shouldNag({ textsEnabled, status }: NagInput): boolean {
  return textsEnabled && !status.complete;
}
