import { useEffect, useState } from 'react'
import { loadDataset, type Dataset } from '@/lib/data'

type DatasetState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: Dataset; error: null }
  | { status: 'error'; data: null; error: Error }

export function useDataset(): DatasetState {
  const [s, setS] = useState<DatasetState>({
    status: 'loading',
    data: null,
    error: null,
  })

  useEffect(() => {
    let alive = true
    loadDataset()
      .then((d) => {
        if (alive) setS({ status: 'ready', data: d, error: null })
      })
      .catch((e: unknown) => {
        if (alive)
          setS({
            status: 'error',
            data: null,
            error: e instanceof Error ? e : new Error(String(e)),
          })
      })
    return () => {
      alive = false
    }
  }, [])

  return s
}
