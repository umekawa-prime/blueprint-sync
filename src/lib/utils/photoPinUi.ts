export type PhotoPinView = {
  hoverId: string | null;
  modalId: string | null;
  draggingId: string | null;
};

export const PIN_DRAG_HOLD_MS = 400;
export const PIN_DRAG_MOVE_PX = 8;

export function idlePhotoPinView(): PhotoPinView {
  return { hoverId: null, modalId: null, draggingId: null };
}

export function hoverPhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  if (view.modalId || view.draggingId) {
    return view;
  }
  return { ...view, hoverId: id };
}

export function leavePhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  if (view.modalId || view.hoverId !== id) {
    return view;
  }
  return { ...view, hoverId: null };
}

export function clickPhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  return { hoverId: null, modalId: id, draggingId: null };
}

export function tapPhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  if (view.hoverId === id && !view.modalId) {
    return clickPhotoPin(view, id);
  }
  return { hoverId: id, modalId: null, draggingId: null };
}

export function closePhotoPinModal(view: PhotoPinView): PhotoPinView {
  return { hoverId: null, modalId: null, draggingId: null };
}

export function startPinDrag(view: PhotoPinView, id: string): PhotoPinView {
  return { hoverId: null, modalId: null, draggingId: id };
}

export function shouldArmPinDrag(
  pointerType: string,
  heldMs: number,
  movedPx: number,
): boolean {
  if (pointerType === "mouse") {
    return movedPx > PIN_DRAG_MOVE_PX;
  }
  return heldMs >= PIN_DRAG_HOLD_MS;
}

export function pinPositionFromPointer(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): { nx: number; ny: number } {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return { nx: 0, ny: 0 };
  }
  return {
    nx: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
    ny: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
  };
}
