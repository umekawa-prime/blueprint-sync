import { describe, expect, it } from "vitest";
import {
  PIN_DRAG_HOLD_MS,
  clickPhotoPin,
  closePhotoPinModal,
  hoverPhotoPin,
  idlePhotoPinView,
  leavePhotoPin,
  pinPositionFromPointer,
  shouldArmPinDrag,
  startPinDrag,
  tapPhotoPin,
} from "./photoPinUi";

describe("photoPinUi", () => {
  it("hovering a pin opens a small preview, not the modal", () => {
    const view = hoverPhotoPin(idlePhotoPinView(), "pin-1");
    expect(view.hoverId).toBe("pin-1");
    expect(view.modalId).toBeNull();
  });

  it("leaving the pin closes the hover preview", () => {
    const hovered = hoverPhotoPin(idlePhotoPinView(), "pin-1");
    expect(leavePhotoPin(hovered, "pin-1")).toEqual(idlePhotoPinView());
  });

  it("clicking a pin opens the modal and hides the hover preview", () => {
    const hovered = hoverPhotoPin(idlePhotoPinView(), "pin-1");
    expect(clickPhotoPin(hovered, "pin-1")).toEqual({
      hoverId: null,
      modalId: "pin-1",
      draggingId: null,
    });
  });

  it("clicking the hover preview of another pin opens that pin's modal", () => {
    const hovered = hoverPhotoPin(idlePhotoPinView(), "pin-2");
    expect(clickPhotoPin(hovered, "pin-2").modalId).toBe("pin-2");
  });

  it("does not close the modal when the pointer leaves the pin", () => {
    const modal = clickPhotoPin(idlePhotoPinView(), "pin-1");
    expect(leavePhotoPin(modal, "pin-1")).toEqual(modal);
    expect(hoverPhotoPin(modal, "pin-1")).toEqual(modal);
  });

  it("closes only the modal overlay", () => {
    const modal = clickPhotoPin(idlePhotoPinView(), "pin-1");
    expect(closePhotoPinModal(modal)).toEqual(idlePhotoPinView());
  });

  it("uses tap-to-preview then a second tap for the modal on phone", () => {
    const preview = tapPhotoPin(idlePhotoPinView(), "pin-1");
    expect(preview).toEqual({ hoverId: "pin-1", modalId: null, draggingId: null });
    expect(tapPhotoPin(preview, "pin-1")).toEqual({ hoverId: null, modalId: "pin-1", draggingId: null });
  });

  it("maps a pointer on the drawing to a clamped pin position", () => {
    expect(
      pinPositionFromPointer(150, 80, { left: 100, top: 50, width: 200, height: 100 }),
    ).toEqual({ nx: 0.25, ny: 0.3 });
    expect(
      pinPositionFromPointer(-10, 400, { left: 0, top: 0, width: 100, height: 100 }),
    ).toEqual({ nx: 0, ny: 1 });
  });

  it("arms a pin drag after a hold on touch, or after moving on mouse", () => {
    expect(shouldArmPinDrag("touch", PIN_DRAG_HOLD_MS, 0)).toBe(true);
    expect(shouldArmPinDrag("touch", PIN_DRAG_HOLD_MS - 1, 0)).toBe(false);
    expect(shouldArmPinDrag("mouse", 0, 9)).toBe(true);
    expect(shouldArmPinDrag("mouse", PIN_DRAG_HOLD_MS, 0)).toBe(false);
  });

  it("starts a pin drag by clearing preview and modal", () => {
    const modal = clickPhotoPin(idlePhotoPinView(), "pin-1");
    expect(startPinDrag(modal, "pin-2")).toEqual({
      hoverId: null,
      modalId: null,
      draggingId: "pin-2",
    });
  });
});
