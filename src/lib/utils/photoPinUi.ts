export type PhotoPinView = {
  hoverId: string | null;
  modalId: string | null;
};

export function idlePhotoPinView(): PhotoPinView {
  return { hoverId: null, modalId: null };
}

export function hoverPhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  if (view.modalId) {
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
  return { hoverId: null, modalId: id };
}

export function tapPhotoPin(view: PhotoPinView, id: string): PhotoPinView {
  if (view.hoverId === id && !view.modalId) {
    return clickPhotoPin(view, id);
  }
  return { hoverId: id, modalId: null };
}

export function closePhotoPinModal(view: PhotoPinView): PhotoPinView {
  return { ...view, hoverId: null, modalId: null };
}
