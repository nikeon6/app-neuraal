"use client";

/**
 * YoutubeUrlDialog — TEMPORARY STUB
 *
 * The real component was not committed from another machine.
 * This stub keeps the app building until the real file is pushed.
 * TODO: Remove this stub once the real YoutubeUrlDialog is available.
 */

interface YoutubeUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function YoutubeUrlDialog({ isOpen, onClose, onSubmit }: Readonly<YoutubeUrlDialogProps>) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-lg mb-4">Add YouTube Video</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("url") as HTMLInputElement)?.value?.trim();
            if (input) {
              onSubmit(input);
              onClose();
            }
          }}
        >
          <input
            name="url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-sm"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-sm bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors font-medium"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
