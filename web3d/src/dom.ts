// Helper DOM kecil: bikin elemen, toast, modal.
export type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k in el) {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const nodes = (...children: Child[]): (Node | string)[] =>
  children.filter((c): c is Node | string => !!c);

export const ui = document.getElementById("ui")!;
export const sceneEl = document.getElementById("scene")!;

export function toast(msg: string): void {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

/** Tampilkan modal. Mengembalikan fungsi untuk menutupnya. */
export function modal(content: HTMLElement, onClose?: () => void, dismissable = true): () => void {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    onClose?.();
  };
  const overlay = h(
    "div",
    { class: "overlay", onclick: (e: Event) => dismissable && e.target === overlay && close() },
    content,
  );
  document.body.append(overlay);
  return close;
}

export function confirmBox(title: string, text: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const box = h(
      "div",
      { class: "sheet col" },
      h("div", { class: "sheet-title" }, title),
      h("div", {}, text),
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn grey", onclick: () => close() }, "Batal"),
        h(
          "button",
          {
            class: "btn red",
            onclick: () => {
              answer = true;
              close();
            },
          },
          okLabel,
        ),
      ),
    );
    const close = modal(box, () => resolve(answer));
  });
}
