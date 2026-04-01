import { getInitialSettings } from '../utils/settings/settings.js'

export async function isKairosEnabled(): Promise<boolean> {
  return getInitialSettings().assistant === true
}
