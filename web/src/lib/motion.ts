// Motion that needs script: the sliding thumb behind the active item of a nav or a
// segmented control, and the cross-fade between routes.
import { flushSync } from 'svelte'
import { theme } from './theme.svelte'

/**
 * Svelte action for a container with a thumb element and one active child
 * (`aria-current="page"` or `aria-checked="true"`). It writes the active child's
 * place to `--thumb-x` and `--thumb-w`; CSS moves the thumb. Pass the active value
 * so the action measures again when it changes.
 */
export function thumb(node: HTMLElement, _active: unknown) {
  const measure = () => {
    const a = node.querySelector<HTMLElement>('[aria-current="page"], [aria-checked="true"]')
    node.style.setProperty('--thumb-x', `${a?.offsetLeft ?? 0}px`)
    node.style.setProperty('--thumb-w', `${a?.offsetWidth ?? 0}px`)
    node.toggleAttribute('data-empty', !a)
    // keep the active item in view when the container scrolls sideways (the nav at phone width)
    if (a && node.scrollWidth > node.clientWidth) {
      const pad = 24, left = a.offsetLeft - pad, right = a.offsetLeft + a.offsetWidth + pad
      if (left < node.scrollLeft) node.scrollLeft = left
      else if (right > node.scrollLeft + node.clientWidth) node.scrollLeft = right - node.clientWidth
    }
  }
  measure()
  // the first placement must not animate
  const raf = requestAnimationFrame(() => node.setAttribute('data-ready', ''))
  const ro = new ResizeObserver(measure)
  ro.observe(node)
  for (const child of node.children) ro.observe(child)
  return { update: measure, destroy() { cancelAnimationFrame(raf); ro.disconnect() } }
}

/** Run a DOM change as a view transition: the old page fades out, the new one fades in. Without the API, or with reduced motion, the change is immediate. */
export function transition(change: () => void) {
  if (theme.reduced || !document.startViewTransition) { change(); return }
  document.startViewTransition(() => { flushSync(change) })
}
