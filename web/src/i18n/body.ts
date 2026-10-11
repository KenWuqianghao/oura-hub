// The words of this page. Add a key to `en`; the type check then asks for it in `zh`.
export const en = {} as const
export const zh = {} satisfies Record<keyof typeof en, string>
