import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { clearFormDraft, getFormDraft, saveFormDraft } from '@/db/database';

export function useFormDraft<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>, () => Promise<void>] {
  const [value, setValue] = useState(initialValue);
  const hydrated = useRef(false);
  const cleared = useRef(false);

  useEffect(() => {
    let mounted = true;
    hydrated.current = false;
    cleared.current = false;
    setValue(initialValue);
    void getFormDraft<T>(key).then((draft) => {
      if (!mounted) return;
      if (draft !== null) setValue(draft);
      hydrated.current = true;
    });
    return () => {
      mounted = false;
    };
  }, [key]);

  useEffect(() => {
    if (hydrated.current && !cleared.current) void saveFormDraft(key, value);
  }, [key, value]);

  return [
    value,
    setValue,
    async () => {
      cleared.current = true;
      await clearFormDraft(key);
    }
  ];
}
