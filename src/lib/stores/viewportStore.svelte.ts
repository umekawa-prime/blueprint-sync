import { isPhoneWidth } from "$lib/utils/chromeLayout";

class ViewportStore {
  width = $state(typeof window === "undefined" ? 1024 : window.innerWidth);

  get isPhone() {
    return isPhoneWidth(this.width);
  }

  bind(): () => void {
    if (typeof window === "undefined") {
      return () => undefined;
    }
    const onResize = () => {
      this.width = window.innerWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }
}

export const viewportStore = new ViewportStore();
