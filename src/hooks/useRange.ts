import { useMemo, useState } from 'react'
import { rangeBounds, toInputDate, type RangeKey } from '../utils/ranges'

export function useRange(initial: RangeKey = 'today') {
  const [key, setKey] = useState<RangeKey>(initial)
  const [from, setFrom] = useState(toInputDate(new Date()))
  const [to, setTo] = useState(toInputDate(new Date()))
  // Se recalcula al cambiar de día aunque la app siga abierta
  const day = toInputDate(new Date())
  const bounds = useMemo(() => rangeBounds(key, from, to), [key, from, to, day])
  return { key, setKey, from, setFrom, to, setTo, bounds }
}
