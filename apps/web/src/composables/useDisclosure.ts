import { ref, useId } from "vue";

export function useDisclosure(initialOpen = false) {
  const contentId = useId();
  const open = ref(initialOpen);

  function toggle(): void {
    open.value = !open.value;
  }

  function close(): void {
    open.value = false;
  }

  return { contentId, open, toggle, close };
}
