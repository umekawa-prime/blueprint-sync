import { describe, expect, it } from "vitest";
import {
  clickPhotoPin,
  closePhotoPinModal,
  hoverPhotoPin,
  idlePhotoPinView,
  leavePhotoPin,
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
});
