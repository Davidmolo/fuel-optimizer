import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type CounterState = {
  value: number;
};

const initialState: CounterState = {
  value: 0,
};

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
    resetCounter: (state) => {
      state.value = initialState.value;
    },
  },
});

export const { decrement, increment, incrementByAmount, resetCounter } = counterSlice.actions;
export default counterSlice.reducer;
