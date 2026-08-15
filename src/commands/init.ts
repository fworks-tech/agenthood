import type { CommandDescriptor } from './types.ts'
import { init } from '../init/index.ts'

export { init }

export const command: CommandDescriptor = {
  name: 'init',
  description: 'Initiate the Society in your project',
  handler: (args) => init(args),
}
