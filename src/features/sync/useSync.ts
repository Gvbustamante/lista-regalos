import { useSyncExternalStore } from 'react'
import { syncStore } from './engine'

export const useSyncState = () => useSyncExternalStore(syncStore.subscribe, syncStore.get)
