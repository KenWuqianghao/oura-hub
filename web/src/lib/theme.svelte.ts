// What the system asks for: dark or light, motion or none. Reactive, so a chart
// option that reads `tokens()` is built again when the scheme changes.
const dark = matchMedia('(prefers-color-scheme: dark)')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
export const theme = $state({ dark: dark.matches, reduced: reduced.matches })
dark.addEventListener('change', e => { theme.dark = e.matches })
reduced.addEventListener('change', e => { theme.reduced = e.matches })
