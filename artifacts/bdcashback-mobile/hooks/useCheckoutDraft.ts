import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const DRAFT_KEY = '@bdcashback/checkout_draft';

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
}

export interface CheckoutDraft {
  address: DeliveryAddress;
  paymentMethod: 'cod' | 'wallet';
}

const INITIAL_DRAFT: CheckoutDraft = {
  address: { name: '', phone: '', address: '', city: '' },
  paymentMethod: 'cod',
};

export function useCheckoutDraft() {
  const [draft, setDraftState] = useState<CheckoutDraft>(INITIAL_DRAFT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val) as CheckoutDraft;
          setDraftState({ ...INITIAL_DRAFT, ...parsed });
        } catch {
          // ignore corrupt data
        }
      }
      setLoaded(true);
    });
  }, []);

  const setDraft = useCallback(
    (update: Partial<CheckoutDraft> | ((prev: CheckoutDraft) => CheckoutDraft)) => {
      setDraftState((prev) => {
        const next =
          typeof update === 'function' ? update(prev) : { ...prev, ...update };
        AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    AsyncStorage.removeItem(DRAFT_KEY);
    setDraftState(INITIAL_DRAFT);
  }, []);

  const hasDraft = loaded && draft.address.name.trim().length > 0;

  return { draft, setDraft, clearDraft, loaded, hasDraft };
}
