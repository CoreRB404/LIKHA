const $ = (id) => document.getElementById(id);
const api = (...args) => window.LikhaAPI.request(...args);
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
let status;
function announce(message) {
  if (!status) {
    status = $("hostStatus") || node("p", "", "host-status");
    status.id = "hostStatus";
    status.setAttribute("role", "status");
    if (!status.parentNode) document.body.append(status);
  }
  status.textContent = message;
  status.hidden = false;
  const modal = document.querySelector('[role="dialog"][aria-hidden="false"]');
  if (modal) {
    let messageBox = modal.querySelector(".dialog-status");
    if (!messageBox) {
      messageBox = node("p", "", "dialog-status");
      messageBox.setAttribute("role", "alert");
      modal.append(messageBox);
    }
    messageBox.textContent = message;
  }
}
async function busy(button, action, messageTarget) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await action();
  } catch (error) {
    if (messageTarget) {
      messageTarget.textContent = error.message;
      messageTarget.setAttribute("role", "alert");
      messageTarget.tabIndex = -1;
      messageTarget.focus();
    } else announce(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function dialog(modal, { initialFocus, onClose = () => {} } = {}) {
  let trigger;
  let background = [];
  const focusables = () =>
    [
      ...modal.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex="0"]',
      ),
    ].filter((el) => el.getClientRects().length);
  function close() {
    modal.querySelector(".dialog-status")?.remove();
    modal.hidden = true;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    for (const [element, inert] of background) element.inert = inert;
    background = [];
    onClose();
    if (trigger?.isConnected) trigger.focus();
  }
  function open(source) {
    trigger = source || document.activeElement;
    modal.hidden = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("role", "dialog");
    let branch = modal;
    while (
      branch.parentElement &&
      branch.parentElement !== document.documentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling !== branch &&
          !["SCRIPT", "LINK", "STYLE"].includes(sibling.tagName)
        ) {
          background.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    (initialFocus || focusables()[0] || modal).focus();
  }
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab") {
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  return { open, close };
}

export { $, api, node, announce, busy, dialog };
