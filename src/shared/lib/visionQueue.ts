/**
 * VisionQueue — singleton that serializes Vision AI requests to prevent
 * overloading the Ollama server (CPU-only, limited parallelism).
 *
 * Each call to `enqueue()` waits for all previously enqueued tasks to finish
 * before executing. This avoids multiple simultaneous requests that would
 * queue up inside Ollama and likely timeout.
 *
 * The queue also exposes the current pending count so the UI can show
 * "Queued (N ahead)..." feedback.
 */

type VisionTask<T> = () => Promise<T>;

/** Listeners that want to be notified when pending count changes. */
type PendingListener = (pending: number) => void;

class VisionQueueImpl {
  /** Chain of promises — each new task awaits the previous one. */
  private chain: Promise<unknown> = Promise.resolve();

  /** Number of tasks waiting (including the one currently running). */
  private _pending = 0;

  /** Subscribers to pending count changes. */
  private readonly listeners = new Set<PendingListener>();

  /** Current number of pending tasks (running + queued). */
  get pending(): number {
    return this._pending;
  }

  /**
   * Enqueue a vision task. Returns a promise that resolves with the task's
   * result once it's the task's turn to execute.
   */
  enqueue<T>(task: VisionTask<T>): Promise<T> {
    this._pending++;
    this.notifyListeners();

    // Create a new link in the chain
    const result = this.chain.then(
      () => task(),
      // If the previous task threw (shouldn't happen since we catch below),
      // still run this task.
      () => task()
    );

    // Update chain — catch to prevent unhandled rejections from breaking the chain
    this.chain = result.catch(() => {}).finally(() => {
      this._pending--;
      this.notifyListeners();
    });

    return result;
  }

  /**
   * Subscribe to pending count changes.
   * Returns an unsubscribe function.
   */
  onPendingChange(listener: PendingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this._pending);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/** Singleton vision queue instance. */
export const visionQueue = new VisionQueueImpl();
