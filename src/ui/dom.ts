/**
 * Мелкие помощники DOM.
 *
 * Смысл файла: вся разметка собирается узлами (`createElement` + `append`),
 * без `innerHTML`-склейки. Так экраны не превращаются в строковые шаблоны,
 * которые потом невозможно аккуратно обновлять по кадрам.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function button(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'ghost' = 'primary',
): HTMLButtonElement {
  const node = el('button', `btn btn--${variant}`, label)
  node.type = 'button'
  node.addEventListener('click', onClick)
  return node
}

export interface Line {
  readonly root: HTMLElement
  set(value: string): void
}

/** Строка «подпись → значение»: один узел и одна функция обновления. */
export function labeledLine(labelText: string, className = 'line'): Line {
  const root = el('div', className)
  const value = el('span', 'line__value', '—')
  root.append(el('span', 'line__label', labelText), value)
  return { root, set: (text: string) => { value.textContent = text } }
}
