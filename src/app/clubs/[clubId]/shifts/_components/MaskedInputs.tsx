import React, { useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  DATE_MASK_TEMPLATE,
  DATE_EDITABLE_POSITIONS,
  buildMaskedDateDisplay,
  extractMaskedDateDigits,
  dateToInternal,
  DATE_TIME_MASK_TEMPLATE,
  DATE_TIME_EDITABLE_POSITIONS,
  buildMaskedDateTimeDisplay,
  extractMaskedDateTimeDigits,
  displayToLocalDateTime,
} from "../_utils";

type MaskedDateInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (displayValue: string, internalValue: string) => void;
};

export function MaskedDateInput({
  value,
  onValueChange,
  className,
  placeholder = "ДД.ММ.ГГГГ",
  ...props
}: MaskedDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setCaretToSlot = useCallback((slot: number) => {
    const safeSlot = Math.max(
      0,
      Math.min(slot, DATE_EDITABLE_POSITIONS.length - 1),
    );
    const caretPos = DATE_EDITABLE_POSITIONS[safeSlot];
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(caretPos, caretPos);
    });
  }, []);

  const setCaretToPosition = useCallback((position: number) => {
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(position, position);
    });
  }, []);

  const findSlotAtOrAfter = useCallback((position: number) => {
    return DATE_EDITABLE_POSITIONS.findIndex((pos) => pos >= position);
  }, []);

  const findSlotAtOrBefore = useCallback((position: number) => {
    for (let i = DATE_EDITABLE_POSITIONS.length - 1; i >= 0; i -= 1) {
      if (DATE_EDITABLE_POSITIONS[i] <= position) return i;
    }
    return -1;
  }, []);

  const commitDigits = useCallback(
    (digits: string[], nextCaretSlot?: number) => {
      const nextDisplay = buildMaskedDateDisplay(digits);
      onValueChange(nextDisplay, dateToInternal(nextDisplay));
      if (typeof nextCaretSlot === "number") {
        setCaretToSlot(nextCaretSlot);
      }
    },
    [onValueChange, setCaretToSlot],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentValue = value || "";
      const digits = extractMaskedDateDigits(currentValue);
      const selectionStart = e.currentTarget.selectionStart ?? 0;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart);
        if (slot === -1) return;
        digits[slot] = e.key;
        commitDigits(
          digits,
          Math.min(slot + 1, DATE_EDITABLE_POSITIONS.length - 1),
        );
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0));
        if (slot === -1) return;
        digits[slot] = "_";
        commitDigits(digits, slot);
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart);
        if (slot === -1) return;
        digits[slot] = "_";
        commitDigits(digits, slot);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0));
        if (slot === -1) {
          setCaretToPosition(0);
        } else {
          setCaretToSlot(slot);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart + 1);
        if (slot === -1) {
          setCaretToPosition(DATE_MASK_TEMPLATE.length);
        } else {
          setCaretToSlot(slot);
        }
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        setCaretToPosition(0);
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        setCaretToPosition(DATE_MASK_TEMPLATE.length);
      }
    },
    [
      commitDigits,
      findSlotAtOrAfter,
      findSlotAtOrBefore,
      setCaretToPosition,
      setCaretToSlot,
      value,
    ],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedDigits = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!pastedDigits) return;

      const digits = extractMaskedDateDigits(value || "");
      const selectionStart = e.currentTarget.selectionStart ?? 0;
      let slot = findSlotAtOrAfter(selectionStart);
      if (slot === -1) slot = 0;

      for (const digit of pastedDigits) {
        if (slot >= digits.length) break;
        digits[slot] = digit;
        slot += 1;
      }

      commitDigits(digits, Math.min(slot, DATE_EDITABLE_POSITIONS.length - 1));
    },
    [commitDigits, findSlotAtOrAfter, value],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!e.currentTarget.value) {
        setCaretToPosition(0);
      }
    },
    [setCaretToPosition],
  );

  return (
    <Input
      {...props}
      ref={inputRef}
      value={value}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={className}
    />
  );
}

type MaskedDateTimeInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (displayValue: string, internalValue: string) => void;
};

export function MaskedDateTimeInput({
  value,
  onValueChange,
  className,
  placeholder = "ДД.ММ.ГГГГ, ЧЧ:ММ",
  ...props
}: MaskedDateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setCaretToSlot = useCallback((slot: number) => {
    const safeSlot = Math.max(
      0,
      Math.min(slot, DATE_TIME_EDITABLE_POSITIONS.length - 1),
    );
    const caretPos = DATE_TIME_EDITABLE_POSITIONS[safeSlot];
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(caretPos, caretPos);
    });
  }, []);

  const setCaretToPosition = useCallback((position: number) => {
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(position, position);
    });
  }, []);

  const findSlotAtOrAfter = useCallback((position: number) => {
    return DATE_TIME_EDITABLE_POSITIONS.findIndex((pos) => pos >= position);
  }, []);

  const findSlotAtOrBefore = useCallback((position: number) => {
    for (let i = DATE_TIME_EDITABLE_POSITIONS.length - 1; i >= 0; i -= 1) {
      if (DATE_TIME_EDITABLE_POSITIONS[i] <= position) return i;
    }
    return -1;
  }, []);

  const commitDigits = useCallback(
    (digits: string[], nextCaretSlot?: number) => {
      const nextDisplay = buildMaskedDateTimeDisplay(digits);
      onValueChange(nextDisplay, displayToLocalDateTime(nextDisplay));
      if (typeof nextCaretSlot === "number") {
        setCaretToSlot(nextCaretSlot);
      }
    },
    [onValueChange, setCaretToSlot],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentValue = value || "";
      const digits = extractMaskedDateTimeDigits(currentValue);
      const selectionStart = e.currentTarget.selectionStart ?? 0;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart);
        if (slot === -1) return;
        digits[slot] = e.key;
        commitDigits(
          digits,
          Math.min(slot + 1, DATE_TIME_EDITABLE_POSITIONS.length - 1),
        );
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0));
        if (slot === -1) return;
        digits[slot] = "_";
        commitDigits(digits, slot);
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart);
        if (slot === -1) return;
        digits[slot] = "_";
        commitDigits(digits, slot);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0));
        if (slot === -1) {
          setCaretToPosition(0);
        } else {
          setCaretToSlot(slot);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const slot = findSlotAtOrAfter(selectionStart + 1);
        if (slot === -1) {
          setCaretToPosition(DATE_TIME_MASK_TEMPLATE.length);
        } else {
          setCaretToSlot(slot);
        }
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        setCaretToPosition(0);
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        setCaretToPosition(DATE_TIME_MASK_TEMPLATE.length);
      }
    },
    [
      commitDigits,
      findSlotAtOrAfter,
      findSlotAtOrBefore,
      setCaretToPosition,
      setCaretToSlot,
      value,
    ],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedDigits = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!pastedDigits) return;

      const digits = extractMaskedDateTimeDigits(value || "");
      const selectionStart = e.currentTarget.selectionStart ?? 0;
      let slot = findSlotAtOrAfter(selectionStart);
      if (slot === -1) slot = 0;

      for (const digit of pastedDigits) {
        if (slot >= digits.length) break;
        digits[slot] = digit;
        slot += 1;
      }

      commitDigits(
        digits,
        Math.min(slot, DATE_TIME_EDITABLE_POSITIONS.length - 1),
      );
    },
    [commitDigits, findSlotAtOrAfter, value],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!e.currentTarget.value) {
        setCaretToPosition(0);
      }
    },
    [setCaretToPosition],
  );

  return (
    <Input
      {...props}
      ref={inputRef}
      value={value}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={className}
    />
  );
}
