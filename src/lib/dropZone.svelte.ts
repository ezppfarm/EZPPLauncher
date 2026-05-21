import { listen } from "@tauri-apps/api/event";
import { onDestroy } from "svelte";

type TauriDragDropEvent = {
  paths: string[];
  position: { x: number; y: number };
};

export const useDropZone = ({ onDrop }: { onDrop: (paths: string[]) => void }) => {
  let element = $state<HTMLDivElement | null>(null);
  let dragIn = $state(false);
  let isDraggingOverApp = $state(false);

  const isOver = (x: number, y: number) => {
    if (!element) return false;
    const el = document.elementFromPoint(x, y);
    return element === el || element.contains(el);  // ← fix
  };

  const dropUnlisten = listen<TauriDragDropEvent>("tauri://drag-drop", (e) => {
    const { x, y } = e.payload.position;
    if (isOver(x, y)) {
      onDrop(e.payload.paths);
    }
    dragIn = false;
    isDraggingOverApp = false;
  });

  const overUnlisten = listen<TauriDragDropEvent>("tauri://drag-over", (e) => {
    const { x, y } = e.payload.position;
    isDraggingOverApp = true;
    dragIn = isOver(x, y);
  });

  const leaveUnlisten = listen("tauri://drag-leave", () => {
    dragIn = false;
    isDraggingOverApp = false;
  });

  onDestroy(async () => {
    (await dropUnlisten)();
    (await overUnlisten)();
    (await leaveUnlisten)();
  });

  return {
    get ref() { return element; },
    set ref(el: HTMLDivElement | null) { element = el; },
    get dragIn() { return dragIn; },
    get isDraggingOverApp() { return isDraggingOverApp; },
  };
};