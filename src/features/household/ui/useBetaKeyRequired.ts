import { useQuery } from '@tanstack/react-query'
import { betaKeyRequired } from '../application/boards'
import { useSession } from './SessionProvider'

/** Whether the start and join screens ask for the beta key. Not asked until
 *  the answer arrives, so a gate-less project never flashes the field. */
export const useBetaKeyRequired = (): boolean => {
  const { client } = useSession()
  const { data } = useQuery({
    queryKey: ['beta-key-required'],
    queryFn: () => betaKeyRequired(client),
  })
  return data ?? false
}
