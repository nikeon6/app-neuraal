import type { ClockPort } from "../ports/ClockPort";

export class FakeClock implements ClockPort {
  private currentTime: Date;

  constructor(fixedTime?: Date) {
    this.currentTime = fixedTime ?? new Date("2026-02-11T12:00:00Z");
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  setTime(date: Date): void {
    this.currentTime = date;
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}
