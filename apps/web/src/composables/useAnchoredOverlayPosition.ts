import { type CSSProperties, ref } from "vue";

export function useAnchoredOverlayPosition() {
  const root = ref<HTMLElement | null>(null);
  const content = ref<HTMLElement | null>(null);
  const style = ref<CSSProperties>({
    top: "0",
    left: "0",
    visibility: "hidden",
  });

  function reposition(align: "start" | "end"): void {
    if (root.value === null || content.value === null) {
      return;
    }
    const trigger = root.value.getBoundingClientRect();
    const box = content.value.getBoundingClientRect();
    const gap = 8;
    const edge = 8;
    const alignedLeft =
      align === "end" ? trigger.right - box.width : trigger.left;
    const left = Math.max(
      edge,
      Math.min(alignedLeft, window.innerWidth - box.width - edge),
    );
    const below = trigger.bottom + gap;
    const above = trigger.top - box.height - gap;
    const top =
      below + box.height <= window.innerHeight - edge || above < edge
        ? below
        : above;
    style.value = {
      top: `${top}px`,
      left: `${left}px`,
      visibility: "visible",
    };
  }

  return { root, content, style, reposition };
}
