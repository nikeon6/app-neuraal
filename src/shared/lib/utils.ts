import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * for optimal Tailwind CSS class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a unique identifier
 */
export function uid() {
  return `${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

/**
 * Clamps a number between min and max values
 */
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Calculates the median of an array of numbers
 */
export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Creates a quadratic bezier path string for SVG
 */
export function quadPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  biasX: number
) {
  const dx = Math.abs(x2 - x1);
  const bend = Math.max(12, Math.min(90, dx * 0.35));
  const cx = (x1 + x2) / 2 + bend * biasX;
  const cy = (y1 + y2) / 2;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}
