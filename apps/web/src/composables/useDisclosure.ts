import { ref, useId } from "vue";

export function useDisclosure() {
  const contentId = useId();
  const open = ref(false);

  function toggle(): void {
    open.value = !open.value;
  }

  function close(): void {
    open.value = false;
  }

  return { contentId, open, toggle, close };
}
