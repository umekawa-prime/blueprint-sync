import { describe, expect, it } from "vitest";
import {
  PIN_DRAG_HOLD_MS,
  clampImageIndex,
  clickPhotoPin,
  closePhotoPinModal,
  closePinMenu,
  hoverPhotoPin,
  idlePhotoPinView,
  leavePhotoPin,
  openPinMenu,
  pinPositionFromPointer,
  shouldArmPinDrag,
  showPinImage,
  startPinDrag,
  staggeredPinPosition,
  stepPinImage,
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
      ...idlePhotoPinView(),
      modalId: "pin-1",
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
    expect(preview).toEqual({ ...idlePhotoPinView(), hoverId: "pin-1" });
    expect(tapPhotoPin(preview, "pin-1")).toEqual({ ...idlePhotoPinView(), modalId: "pin-1" });
  });

  it("staggers stacked pins so multiple attachments stay distinct", () => {
    expect(staggeredPinPosition({ nx: 0.2, ny: 0.3 }, 0)).toEqual({ nx: 0.2, ny: 0.3 });
    expect(staggeredPinPosition({ nx: 0.2, ny: 0.3 }, 2)).toEqual({ nx: 0.28, ny: 0.38 });
    expect(staggeredPinPosition({ nx: 0.98, ny: 0.99 }, 3)).toEqual({ nx: 1, ny: 1 });
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
      ...idlePhotoPinView(),
      draggingId: "pin-2",
    });
  });
});

describe("photoPinUi pin menu", () => {
  it("opens the menu at the pointer and drops the hover preview", () => {
    const hovered = hoverPhotoPin(idlePhotoPinView(), "pin-1");
    const menu = openPinMenu(hovered, "pin-1", 120, 80);
    expect(menu.menu).toEqual({ id: "pin-1", x: 120, y: 80 });
    expect(menu.hoverId).toBeNull();
  });

  it("does not reopen the hover preview while the menu is open", () => {
    const menu = openPinMenu(idlePhotoPinView(), "pin-1", 0, 0);
    expect(hoverPhotoPin(menu, "pin-1")).toEqual(menu);
  });

  it("closes the menu without touching the rest of the view", () => {
    const menu = openPinMenu(idlePhotoPinView(), "pin-1", 0, 0);
    expect(closePinMenu(menu)).toEqual(idlePhotoPinView());
    expect(closePinMenu(idlePhotoPinView())).toEqual(idlePhotoPinView());
  });
});

describe("photoPinUi image selection", () => {
  it("opens a pin on its first image", () => {
    const view = showPinImage(clickPhotoPin(idlePhotoPinView(), "pin-1"), 2, 3);
    expect(view.imageIndex).toBe(2);
    expect(clickPhotoPin(view, "pin-1").imageIndex).toBe(0);
  });

  it("clamps the selected image into the remaining range", () => {
    expect(clampImageIndex(5, 3)).toBe(2);
    expect(clampImageIndex(-1, 3)).toBe(0);
    expect(clampImageIndex(0, 0)).toBe(0);
    expect(showPinImage(idlePhotoPinView(), 4, 2).imageIndex).toBe(1);
  });

  it("cycles through images in both directions", () => {
    const first = idlePhotoPinView();
    expect(stepPinImage(first, 1, 3).imageIndex).toBe(1);
    expect(stepPinImage(first, -1, 3).imageIndex).toBe(2);
    expect(stepPinImage(showPinImage(first, 2, 3), 1, 3).imageIndex).toBe(0);
    expect(stepPinImage(first, 1, 0).imageIndex).toBe(0);
  });
});
