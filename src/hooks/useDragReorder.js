import { useState, useRef, useEffect } from "react";

/**
 * KJS-CES-01 — shared drag-to-reorder primitive (HTML5 drag-and-drop).
 *
 * Same interaction model already prototyped in src/pages/StayOnPage.jsx
 * (Experiment 5), factored out here so the Dashboard's stat row and
 * section headings can reuse the identical drag logic instead of a
 * second copy of it.
 *
 * `items`: initial array (each item needs a stable `id`)
 * `sessionKey`: when given, the order is persisted to sessionStorage
 *   (i.e. for the browser tab's session — cleared when the tab closes)
 *   so a reorder survives a re-render/navigation but not a fresh visit.
 *
 * Returns { order, setOrder, getDragHandlers(index) } — spread
 * getDragHandlers(index) onto the draggable element (or just its handle).
 */
export function useDragReorder(items, sessionKey) {
  const [order, setOrder] = useState(() => {
    if (sessionKey) {
      try {
        const saved = sessionStorage.getItem(sessionKey);
        if (saved) {
          const savedIds = JSON.parse(saved);
          const byId = Object.fromEntries(items.map((it) => [it.id, it]));
          const restored = savedIds.map((id) => byId[id]).filter(Boolean);
          // fall back to the given order if the saved list doesn't match
          if (restored.length === items.length) return restored;
        }
      } catch (e) {}
    }
    return items;
  });

  useEffect(() => {
    if (!sessionKey) return;
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(order.map((it) => it.id)));
    } catch (e) {}
  }, [order, sessionKey]);

  const dragItem = useRef();
  const dragNode = useRef();

  const getDragHandlers = (index) => ({
    draggable: true,
    onDragStart: (e) => {
      dragItem.current = index;
      dragNode.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "drag");
      dragNode.current.addEventListener("dragend", handleDragEnd);
    },
    onDragEnter: (e) => {
      if (dragNode.current === e.currentTarget) return;
      setOrder((old) => {
        const list = old.slice();
        const item = list.splice(dragItem.current, 1)[0];
        list.splice(index, 0, item);
        dragItem.current = index;
        return list;
      });
    },
    onDragOver: (e) => e.preventDefault(),
  });

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.removeEventListener("dragend", handleDragEnd);
    dragItem.current = null;
    dragNode.current = null;
  };

  // Keyboard equivalent of dragging: swaps the item at `index` with its
  // left/right neighbor. Shared by every drag-handle so the arrow-key
  // behavior doesn't get reimplemented per call site.
  const move = (index, direction) => {
    const toIndex = index + direction;
    if (toIndex < 0 || toIndex >= order.length) return;
    setOrder((old) => {
      const list = old.slice();
      const [item] = list.splice(index, 1);
      list.splice(toIndex, 0, item);
      return list;
    });
  };

  return { order, setOrder, getDragHandlers, move };
}
