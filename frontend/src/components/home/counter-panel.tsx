"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import { decrement, increment, incrementByAmount, resetCounter } from "@/store/features/counter-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export default function CounterPanel() {
  const [amount, setAmount] = useState<number>(5);
  const count = useAppSelector((state) => state.counter.value);
  const dispatch = useAppDispatch();

  return (
    <Card className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Redux Toolkit is configured</h2>
        <p className="text-sm text-slate-600">
          This counter is connected through your global store and typed hooks.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => dispatch(decrement())}>-</Button>
        <p className="min-w-16 text-center text-lg font-semibold text-slate-900">{count}</p>
        <Button onClick={() => dispatch(increment())}>+</Button>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor="amount-input">
          Increment by amount
        </label>
        <input
          id="amount-input"
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-offset-1 focus:ring-2 focus:ring-slate-500"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => dispatch(incrementByAmount(amount))}>Apply Amount</Button>
          <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => dispatch(resetCounter())}>
            Reset
          </Button>
        </div>
      </div>
    </Card>
  );
}
