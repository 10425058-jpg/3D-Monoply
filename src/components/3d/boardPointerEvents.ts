import { events } from '@react-three/fiber';

export const boardPointerEvents: typeof events = store => {
  const manager = events(store);
  const handlers = manager.handlers!;
  let pending: MouseEvent | undefined;
  let offsetX = 0, offsetY = 0;
  let frame: number | undefined;

  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    pending = undefined;
  };

  const flush = () => {
    if (!pending) return;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    try { handlers.onPointerMove(pending); }
    finally { pending = undefined; }
  };

  return {
    ...manager,
    compute(event, state, previous) {
      if (event !== pending) {
        manager.compute?.(event, state, previous);
        return;
      }
      // Read offsets during native dispatch, when they are relative to the canvas.
      state.pointer.set(offsetX / state.size.width * 2 - 1, 1 - offsetY / state.size.height * 2);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
    handlers: {
      ...handlers,
      onPointerMove(event) {
        pending = event as MouseEvent;
        offsetX = pending.offsetX;
        offsetY = pending.offsetY;
        if (frame === undefined) frame = requestAnimationFrame(flush);
      },
      onPointerDown(event) { flush(); handlers.onPointerDown(event); },
      onPointerUp(event) { flush(); handlers.onPointerUp(event); },
      onPointerLeave(event) { cancel(); handlers.onPointerLeave(event); },
      onPointerCancel(event) { cancel(); handlers.onPointerCancel(event); },
    },
    disconnect() { cancel(); manager.disconnect?.(); },
  };
};
