import { createGroupAction } from './actions'
import { CreateGroupContainer } from './_containers/create-group/container'

export default function NewGroupPage() {
  return <CreateGroupContainer action={createGroupAction} />
}
