export { init } from '../init/index.js'
import type { CommandDescriptor } from './types.js'
import { init } from '../init/index.js'

export const command: CommandDescriptor = {
  name: 'init',
  description: 'Initiate the Society in your project',
  handler: (args) => init(args),
}
