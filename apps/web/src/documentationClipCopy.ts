export function normalizeClipCopyText(text: string): string {
  return text.trim();
}

function createCopyButton(): { button: HTMLButtonElement; icon: HTMLElement } {
  const icon = document.createElement("i");
  icon.className = "mdi mdi-content-copy docs-clipcopy-icon";
  icon.title = "Copy to clipboard";
  icon.setAttribute("aria-hidden", "true");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "docs-clipcopy-button";
  button.setAttribute("aria-label", "Copy to clipboard");
  button.append(icon);

  return { button, icon };
}

function attachCopyBehavior(
  button: HTMLButtonElement,
  icon: HTMLElement,
  feedbackElement: HTMLElement,
  source: HTMLElement,
): void {
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        normalizeClipCopyText(source.textContent ?? ""),
      );
      feedbackElement.classList.add("docs-clipcopy--copied");
      icon.classList.replace("mdi-content-copy", "mdi-check-circle");
      window.setTimeout(() => {
        feedbackElement.classList.remove("docs-clipcopy--copied");
        icon.classList.replace("mdi-check-circle", "mdi-content-copy");
      }, 1500);
    } catch {
      // The Clipboard API can be unavailable or denied by the browser;
      // the code stays readable and selectable either way.
    }
  };

  button.addEventListener("click", () => void copy());
}

export function decorateClipCopyCallouts(root: ParentNode): void {
  for (const code of root.querySelectorAll<HTMLElement>("code")) {
    if (code.dataset.clipcopyReady === "true") {
      continue;
    }
    code.dataset.clipcopyReady = "true";

    const pre = code.closest("pre");
    const { button, icon } = createCopyButton();

    if (pre !== null) {
      const wrapper = document.createElement("div");
      wrapper.className = "docs-clipcopy-block";
      pre.replaceWith(wrapper);
      wrapper.append(pre);
      button.classList.add("docs-clipcopy-block-button");
      wrapper.append(button);
      attachCopyBehavior(button, icon, wrapper, code);
      continue;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "docs-clipcopy";
    code.replaceWith(wrapper);
    wrapper.append(code, button);
    attachCopyBehavior(button, icon, wrapper, code);
  }
}
