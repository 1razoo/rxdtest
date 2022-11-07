import { expect } from "@jest/globals";
import { MatcherFunction } from "expect";
import { AxiosResponse } from "axios";

const toBeValidTx: MatcherFunction = function (rpcResponse: unknown) {
  const { data } = rpcResponse as AxiosResponse;
  const { result: txId } = data;

  const pass = txId?.length == 64 && data.error === null;
  if (pass) {
    return {
      message: () => `Expected valid tx`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected: valid tx\nReceived: ${this.utils.printReceived(
          data.error.message
        )}`,
      pass: false,
    };
  }
};

const toReturnError: MatcherFunction<[message: string]> = function (
  rpcResponse: unknown,
  message: string
) {
  const { data } = rpcResponse as AxiosResponse;

  const received = data?.error?.message;
  const pass = message === received;

  if (pass) {
    return {
      message: () =>
        `Expected: ${this.utils.printExpected(
          message
        )}\nReceived: ${this.utils.printReceived(received)}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected: ${this.utils.printExpected(
          message
        )}\nReceived: ${this.utils.printReceived(received)}`,
      pass: false,
    };
  }
};

expect.extend({
  toBeValidTx,
  toReturnError,
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTx(): R;
      toReturnError(message: string): R;
    }
  }
}
